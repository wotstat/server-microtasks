import { clickhouse } from '@/db'
import { LoaderResult } from '..'

const ONE_SECOND = 1000
const ONE_MINUTE = 60 * ONE_SECOND
const ONE_HOUR = 60 * ONE_MINUTE
const ONE_DAY = 24 * ONE_HOUR


const skipUntilByRegion = new Map<string, number>()

export async function load(region: string, baseUrl: string) {
  if (region != 'RU' && region != 'RPT') return

  if (skipUntilByRegion.has(region) && skipUntilByRegion.get(region)! > Date.now()) return

  const balance = await fetch(`${baseUrl}/goldwagon/api/balance`)

  if (!balance.ok) {
    const balanceText = await balance.text()
    const skipLog =
      balanceText.includes('event_expired') ||
      balanceText.includes('event_not_started')

    if (!skipLog) console.error(`Error loading goldwagon balance for region ${region}:`, balanceText)

    skipUntilByRegion.set(region, Date.now() + ONE_MINUTE)
    return
  }

  const balanceData = await balance.json() as { balance: number } | { error: string }

  if ('error' in balanceData) {
    const skipLog =
      balanceData.error.includes('event_expired') ||
      balanceData.error.includes('event_not_started')

    if (!skipLog) console.error(`Error loading goldwagon balance for region ${region}:`, balanceData.error)

    skipUntilByRegion.set(region, Date.now() + ONE_MINUTE)
    return
  }

  await clickhouse.insert({
    table: 'WOT.GoldWagonHistory',
    values: [{
      region,
      balance: balanceData.balance,
      dateTime: Math.round(new Date().getTime())
    }],
    format: 'JSONEachRow'
  })
}