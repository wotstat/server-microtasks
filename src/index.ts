import { connect } from "./db";
import { load as wotSrcLoad } from "./tasks/wot-src-loader";
import { load as wotAssetsLoad } from "./tasks/wot-img-loader";
import { load as forumLoader } from "./tasks/forum-loader";
import { schedule } from "node-cron";
import { setup as setupApiLoader } from "./tasks/api-loader";
import { load as publicApiLoad } from "./tasks/public-api-loader";

console.log('Connecting to ClickHouse...');

if (!await connect({ timeout: 10 })) {
  throw new Error('ClickHouse is not available')
}

await setupApiLoader()
// await wotSrcLoad()
// await wotAssetsLoad()
// await forumLoader()
// await publicApiLoad()

let isWorking = false
let alreadyWorkingError = 0
schedule('0 */2 * * *', async () => {

  if (isWorking) {
    alreadyWorkingError++
    console.error(`Task is already running (${alreadyWorkingError} times)`);

    if (alreadyWorkingError > 5) {
      console.error(`Task is already running for a long time, exiting...`);
      process.exit(1)
    }
    return
  }

  alreadyWorkingError = 0
  isWorking = true

  await wotSrcLoad()
  await wotAssetsLoad()
  await forumLoader()
  await publicApiLoad()

  isWorking = false
});
