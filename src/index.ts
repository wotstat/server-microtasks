import { sleep } from "bun";
import { connect } from "./db";
import { load as wotSrcLoad } from "./tasks/wot-src-loader";
import { schedule } from "node-cron";

console.log('Connecting to ClickHouse...');

if (!await connect({ timeout: 10 })) {
  throw new Error('ClickHouse is not available')
}

schedule('0 4 * * *', async () => {
  await wotSrcLoad()
});
