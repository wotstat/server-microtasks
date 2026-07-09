import { encode } from 'cbor-x';
import { clickhouse } from '@/db';
import {
  decodeFanoutData,
  decodeFanoutMessage,
  parseResourceWellPayload,
  parseUInt,
} from './protocol';

/*
from helpers import dependency
from skeletons.gui.lobby_context import ILobbyContext
from skeletons.gui.game_control import IResourceWellController

lobby = dependency.instance(ILobbyContext)
rw = dependency.instance(IResourceWellController)

cfg = lobby.getServerSettings().getReactiveCommunicationConfig()

print('enabled =', cfg.isEnabled)
print('url =', cfg.url)
print('top sequence =', rw.getRewardSequence(True))
print('regular sequence =', rw.getRewardSequence(False))
print('top channel =', 'suv_' + rw.getRewardSequence(True))
print('regular channel =', 'suv_' + rw.getRewardSequence(False))
*/
const RESOURCE_WELL_CONFIGS: { region: string, url: string, channels: string[] }[] = [
  {
    region: 'RU',
    url: 'wss://hermod-ru.lstprod.net:443/fanout',
    channels: [
      'suv_rws11prodtop',
      'suv_rws11prodbasic',

      'suv_rws12prodtop',
      'suv_rws12prodbasic',
    ],
  },
];

const RECONNECT_DELAY_MIN = 1_000;
const RECONNECT_DELAY_MAX = 30_000;


async function toBinaryData(data: string | ArrayBuffer | Uint8Array | Blob) {
  if (data instanceof Uint8Array || data instanceof ArrayBuffer) return data;
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return null;
}

function connect(config: { region: string, url: string, channels: string[] }) {
  const cidToChannel = new Map<number, string>();
  const lastSeqidByChannel = new Map<string, number>();
  let reconnectAttempts = 0;

  function sendCommand(ws: WebSocket, channel: string, cmd: 'subscribe' | 'unsubscribe' | 'get_last') {
    ws.send(encode({ channel, cmd }));
  }

  const open = () => {
    const ws = new WebSocket(config.url);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log(`[resource-well:${config.region}] connected`);
      for (const channel of config.channels) sendCommand(ws, channel, 'subscribe');
    };

    ws.onmessage = async event => {
      try {
        const binaryData = await toBinaryData(event.data);
        if (!binaryData) {
          console.warn(`[resource-well:${config.region}] unsupported text message`);
          return;
        }

        const message = decodeFanoutMessage(binaryData);
        const cid = parseUInt(message.cid);
        const channel = typeof message.channel === 'string' ? message.channel : null;
        const status = typeof message.status === 'string' ? message.status : null;

        if (channel && status) {
          if (cid !== null) cidToChannel.set(cid, channel);

          if (status === 'subscribed') {
            sendCommand(ws, channel, 'get_last');
          }

          if (message.data == null) return;
        }

        if (cid === null || message.data == null) {
          console.warn(`[resource-well:${config.region}] unknown fanout message`, message);
          return;
        }

        const messageChannel = cidToChannel.get(cid);
        if (!messageChannel) {
          console.warn(`[resource-well:${config.region}] channel not found for cid ${cid}`);
          return;
        }

        const seqid = parseUInt(message.seqid);
        if (seqid === null) {
          console.warn(`[resource-well:${config.region}] invalid seqid`, message.seqid);
          return;
        }

        if ((lastSeqidByChannel.get(messageChannel) ?? 0) >= seqid) return;

        const data = decodeFanoutData(message.data);
        const payload = parseResourceWellPayload(data);
        if (!payload) {
          console.warn(`[resource-well:${config.region}] invalid counter payload`, data);
          return;
        }

        try {
          await clickhouse.insert({
            table: 'WOT.ResourceWellHistory',
            values: [{
              region: config.region,
              channel: messageChannel,
              dateTime: new Date().getTime(),
              remainingLots: payload.remainingValues,
              givenLots: payload.givenValues,
            }],
            format: 'JSONEachRow',
          });
        } catch (error) {
          console.error(`[resource-well:${config.region}] ClickHouse insert failed`, error);
          ws.close(1011, 'ClickHouse insert failed');
          return;
        }

        lastSeqidByChannel.set(messageChannel, seqid);
        reconnectAttempts = 0;
      } catch (error) {
        console.error(`[resource-well:${config.region}] failed to process message`, error);
      }
    };

    ws.onerror = event => {
      console.error(`[resource-well:${config.region}] websocket error`, event);
    };

    ws.onclose = event => {
      reconnectAttempts += 1;
      const delay = Math.min(
        RECONNECT_DELAY_MIN * 2 ** (reconnectAttempts - 1),
        RECONNECT_DELAY_MAX,
      );

      console.warn(
        `[resource-well:${config.region}] closed (${event.code}${event.reason ? `: ${event.reason}` : ''}); reconnecting in ${delay} ms`,
      );
      setTimeout(open, delay);
    };
  };

  open();
}

export function setup() {
  for (const config of RESOURCE_WELL_CONFIGS) {
    connect(config);
  }
}
