
import { fetch } from 'bun'
import type { LoaderResult } from '../index'
import { clickhouse } from '@/db'

type Comp7LeaderboardResponse = {
  meta: {
    page_number: number
    pages_amount: number
    last_leaderboard_recalculation_ts: number
    next_leaderboard_recalculation_ts: number
    recalculation_interval: number
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
    clan_tag: string
    clan_color: string
  }[]
}

let lastProcessedRecalculationTs = 0
export async function load(region: string, baseUrl: string): Promise<LoaderResult> {

  const firstPageResponse = await fetch(`${baseUrl}/wgelen/wot/v1/get_leaderboard?event_id=comp7&leaderboard_id=0&page_number=1`)
  const firstPageData = await firstPageResponse.json() as Comp7LeaderboardResponse

  if (!firstPageData || !firstPageData.meta) {
    if (firstPageResponse.status !== 409) // EventDoesNotExist
      console.error('Invalid response from leaderboard API', { baseUrl, response: firstPageData });
    return { scheduleNextLoad: new Date(Date.now() + 30000) }
  }

  const totalPages = firstPageData.meta.pages_amount
  const lastRecalculationTs = firstPageData.meta.last_leaderboard_recalculation_ts
  const nextRecalculationTs = firstPageData.meta.next_leaderboard_recalculation_ts
  const eliteRankPointsThreshold = firstPageData.meta.elite_rank_points_threshold

  const nextLoadAfter = (nextRecalculationTs * 1000) - Date.now()
  const nextLoadTime = nextLoadAfter > 0 ? new Date(Date.now() + nextLoadAfter) : new Date(Date.now() + 5000)

  if (lastProcessedRecalculationTs == lastRecalculationTs) return { scheduleNextLoad: nextLoadTime }

  lastProcessedRecalculationTs = lastRecalculationTs

  const allData = [...firstPageData.data]

  const loadingStartTime = Date.now()
  console.log(`Loading leaderboard data from ${baseUrl}, total pages: ${totalPages}`);
  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber++) {
    const response = await fetch(`${baseUrl}/wgelen/wot/v1/get_leaderboard?event_id=comp7&leaderboard_id=0&page_number=${pageNumber}`)
    const data = await response.json() as Comp7LeaderboardResponse
    allData.push(...data.data)
  }
  console.log(`Loaded ${totalPages} pages in ${(Date.now() - loadingStartTime) / 1000} seconds, total records: ${allData.length}`);

  const recalculationTime = Math.round(new Date(lastRecalculationTs * 1000).getTime() / 1000)

  const insertValues = allData.map(item => {
    const rating = Number.parseInt(item.p2)

    return {
      region,
      recalculationTime,
      name: item.name,
      bdid: item.spa_id,
      clan: item.clan_tag,
      clanColor: item.clan_color ? parseInt(item.clan_color.slice(1), 16) : 0,
      rank: item.rank,
      rating: rating,
      battlesCount: Number.parseInt(item.p3),
      elite: rating >= eliteRankPointsThreshold
    }
  })

  console.log(`Inserting leaderboard data ${insertValues.length} records...`);
  await clickhouse.insert({
    table: 'WOT.Comp7Leaderboard',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Leaderboard data inserted for ${baseUrl}`);


  return { scheduleNextLoad: nextLoadTime }
}