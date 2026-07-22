
import { fetch } from 'bun'
import type { LoaderResult } from '../index'
import { clickhouse } from '@/db'

const ONE_SECOND = 1000
const ONE_MINUTE = 60 * ONE_SECOND
const ONE_HOUR = 60 * ONE_MINUTE

const PAGE_ATTEMPTS = 5
const PAGE_RETRY_DELAY = 2 * ONE_SECOND

type Comp7LeaderboardResponse = {
  meta: {
    page_number: number
    pages_amount: number
    last_leaderboard_recalculation_ts: number
    next_leaderboard_recalculation_ts: number | null
    recalculation_interval: number | null
    elite_rank_points_threshold: number
    elite_rank_position_threshold: number
  }
  data: {
    spa_id: number
    rank: number
    p1: string
    p2: string
    p3: string
    name: string
    clan_tag: string | null
    clan_color: string | null
  }[]
}

type PageResult =
  | { ok: true, data: Comp7LeaderboardResponse }
  | { ok: false, status: number }

// The API sporadically answers with a `null` body instead of a page, so every page is retried.
async function loadPage(baseUrl: string, pageNumber: number): Promise<PageResult> {
  let lastStatus = 0

  for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, PAGE_RETRY_DELAY * (attempt - 1)))

    try {
      const response = await fetch(`${baseUrl}/wgelen/wot/v1/get_leaderboard?event_id=comp7&leaderboard_id=0&page_number=${pageNumber}`)
      lastStatus = response.status

      const data = await response.json() as Comp7LeaderboardResponse | null
      if (data && data.meta && data.data) return { ok: true, data }

      if (response.status === 409) return { ok: false, status: response.status } // EventDoesNotExist

      console.error(`Invalid leaderboard page ${pageNumber} from ${baseUrl} (status ${response.status}, attempt ${attempt}/${PAGE_ATTEMPTS})`, data)
    } catch (error) {
      console.error(`Failed to load leaderboard page ${pageNumber} from ${baseUrl} (attempt ${attempt}/${PAGE_ATTEMPTS})`, error)
    }
  }

  return { ok: false, status: lastStatus }
}

let lastProcessedRecalculationTs = new Map<string, number>()
const key = (region: string, baseUrl: string) => `${region}-${baseUrl}`
export async function load(region: string, baseUrl: string): Promise<LoaderResult> {

  const firstPage = await loadPage(baseUrl, 1)

  if (!firstPage.ok) {
    if (firstPage.status !== 409) // EventDoesNotExist
      console.error('Invalid response from leaderboard API', { baseUrl, status: firstPage.status })
    return { scheduleNextLoad: new Date(Date.now() + ONE_MINUTE * 5) }
  }

  const firstPageData = firstPage.data
  const totalPages = firstPageData.meta.pages_amount
  const lastRecalculationTs = firstPageData.meta.last_leaderboard_recalculation_ts
  const nextRecalculationTs = firstPageData.meta.next_leaderboard_recalculation_ts
  const eliteRankPositionThreshold = firstPageData.meta.elite_rank_position_threshold

  const nextLoadTime = (() => {
    if (nextRecalculationTs == null) return new Date(Date.now() + ONE_MINUTE * 5)

    const nextLoadAfter = (nextRecalculationTs * 1000) - Date.now()
    if (nextLoadAfter <= 0) return new Date(Date.now() + 5 * ONE_SECOND)
    return new Date(Date.now() + nextLoadAfter)
  })()

  const processedKey = key(region, baseUrl)
  if (lastProcessedRecalculationTs.get(processedKey) == lastRecalculationTs) return { scheduleNextLoad: nextLoadTime }

  const allData = [...firstPageData.data]

  const loadingStartTime = Date.now()
  console.log(`Loading leaderboard data from ${baseUrl} with recalculation timestamp ${lastRecalculationTs}, total pages: ${totalPages}`)
  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
    const page = await loadPage(baseUrl, pageNumber)

    // Never insert a partial snapshot: drop what was loaded and retry the whole leaderboard later.
    if (!page.ok) {
      console.error(`Leaderboard load from ${baseUrl} aborted: page ${pageNumber}/${totalPages} is unavailable (status ${page.status})`)
      return { scheduleNextLoad: new Date(Date.now() + ONE_MINUTE) }
    }

    // Pages loaded after a recalculation belong to a different snapshot and would mix up the ranking.
    if (page.data.meta.last_leaderboard_recalculation_ts !== lastRecalculationTs) {
      console.warn(`Leaderboard on ${baseUrl} was recalculated while loading (${lastRecalculationTs} -> ${page.data.meta.last_leaderboard_recalculation_ts}), restarting`)
      return { scheduleNextLoad: new Date(Date.now() + 5 * ONE_SECOND) }
    }

    allData.push(...page.data.data)
  }
  console.log(`Loaded ${totalPages} pages in ${(Date.now() - loadingStartTime) / 1000} seconds, total records: ${allData.length}`)

  const recalculationTime = Math.round(new Date(lastRecalculationTs * 1000).getTime() / 1000)

  const insertValues = allData.map(item => {
    const rating = Number.parseInt(item.p2)

    return {
      region,
      recalculationTime,
      name: item.name,
      bdid: item.spa_id,
      clan: item.clan_tag ?? '',
      clanColor: item.clan_color ? parseInt(item.clan_color.slice(1), 16) : 0,
      rank: item.rank,
      rating: rating,
      battlesCount: Number.parseInt(item.p3),
      elite: item.rank <= eliteRankPositionThreshold
    }
  })

  console.log(`Inserting leaderboard data ${insertValues.length} records...`)
  await clickhouse.insert({
    table: 'WOT.Comp7Leaderboard',
    values: insertValues,
    format: 'JSONEachRow'
  })
  lastProcessedRecalculationTs.set(processedKey, lastRecalculationTs)
  console.log(`Leaderboard data inserted for ${baseUrl}`)

  await clickhouse.command({ query: 'system refresh view WOT.comp7_leaderboard_daily_by_rank_rmv' })
  await clickhouse.command({ query: 'system wait view WOT.comp7_leaderboard_daily_by_rank_rmv' })
  await clickhouse.command({ query: 'system reload dictionary WOT.Comp7LatestRatingDictionary' })

  return { scheduleNextLoad: nextLoadTime }
}