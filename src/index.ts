import { sleep } from "bun";
import { connect } from "./db";
import { load as wotSrcLoad } from "./tasks/wot-src-loader";
import { load as wotAssetsLoad } from "./tasks/wot-img-loader";
import { schedule } from "node-cron";

console.log('Connecting to ClickHouse...');

if (!await connect({ timeout: 10 })) {
  throw new Error('ClickHouse is not available')
}

await wotAssetsLoad()
await wotSrcLoad()
schedule('0 4 * * *', async () => {
  await wotSrcLoad()
  await wotAssetsLoad()
});
