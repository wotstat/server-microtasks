import { connect } from './db'
import { load as wotSrcLoad } from './tasks/wot-src-loader'
import { load as wotAssetsLoad } from './tasks/wot-img-loader'
import { load as forumLoader } from './tasks/forum-loader'
import { setup as setupApiLoader } from './tasks/api-loader'
import { load as publicApiLoad } from './tasks/public-api-loader'

console.log('Connecting to ClickHouse...')

if (!await connect({ timeout: 10 })) {
  throw new Error('ClickHouse is not available')
}

await setupApiLoader()
// await wotSrcLoad()
// await wotAssetsLoad()
// await forumLoader()
// await publicApiLoad()

const TASK_TIMEOUT = 12 * 60 * 60 * 1000

Bun.cron('0 */2 * * *', async () => {
  const timeout = setTimeout(() => {
    console.error('Task is already running for a long time, exiting...')
    process.exit(1)
  }, TASK_TIMEOUT)

  try {
    await wotSrcLoad()
    await wotAssetsLoad()
    await forumLoader()
    await publicApiLoad()
  } finally {
    clearTimeout(timeout)
  }
})
