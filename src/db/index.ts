import { createClient } from '@clickhouse/client'

const clickhouse = createClient({
  url: Bun.env.CLICKHOUSE_HOST,
  username: Bun.env.CLICKHOUSE_USER,
  password: Bun.env.CLICKHOUSE_PASSWORD,
  request_timeout: 120000,
  keep_alive: { enabled: false },
})

async function connect(options: { timeout?: number }) {
  const timeout = options.timeout ?? 0;
  const delay = 0.5;

  for (let i = 0; i <= timeout; i += delay) {
    try {
      const ping = await clickhouse.query({ query: `select 1;` })
      if (ping && ping.query_id) {
        console.log('ClickHouse connected');
        return true
      }
    } catch (e: any) {
      if (i == 0) console.log(`ClickHouse is not available: ${e?.message}, retrying...`);
    }
    await new Promise(r => setTimeout(r, delay * 1000))
  }
  return false;
}


export { clickhouse, connect }
