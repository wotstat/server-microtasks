import { connect } from "./db";
import { load as wotSrcLoad } from "./tasks/wot-src-loader";
import { load as wotAssetsLoad } from "./tasks/wot-img-loader";
import { load as forumLoader } from "./tasks/forum-loader";
import { schedule } from "node-cron";

console.log('Connecting to ClickHouse...');

if (!await connect({ timeout: 10 })) {
  throw new Error('ClickHouse is not available')
}

await wotAssetsLoad()
await wotSrcLoad()
await forumLoader()

let isWorking = false
schedule('0 */2 * * *', async () => {

  if (isWorking) return console.error('Task is already running');

  isWorking = true

  await wotSrcLoad()
  await wotAssetsLoad()
  await forumLoader()

  isWorking = false
});
