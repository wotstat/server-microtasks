import { clickhouse } from "@/db"

const MOE_URL = 'wot/tanks/mastery/'
const VEHICLE_URL = 'wot/encyclopedia/vehicles/'


type Response<T> = {
  status: 'ok' | (string & {})
  meta: {
    count: number
  }
  data: T
}

type VehicleResponse = Response<Record<string, { tag: string }>>

const MOE_PERCENTILES = ['20', '40', '55', '65', '75', '85', '95', '100'] as const
type MoeResponse = Response<{
  distribution: Record<string, {
    [percentile in typeof MOE_PERCENTILES[number]]: number
  }>,
  updated_at: number
}>

type MasteryResponse = Response<{
  distribution: Record<string, Record<string, number>>,
  updated_at: number
}>

function tagProcessor(tag: string) {
  const prefix = tag.split('_')[0].match(/([a-zA-Z]*)\d*/)?.[1];

  const prefixToNation = {
    'F': 'france',
    'It': 'italy',
    'A': 'usa',
    'G': 'germany',
    'S': 'sweden',
    'GB': 'uk',
    'Pl': 'poland',
    'Ch': 'china',
    'J': 'japan',
    'R': 'ussr',
    'Un': 'intunion',
    'Cz': 'czech'
  }

  const nation = prefixToNation[prefix as keyof typeof prefixToNation]
  if (!nation) return null

  return `${nation}:${tag}`
}

let lastMoeUpdated = {} as Record<string, number>;
let lastMasteriesUpdated = {} as Record<string, number>;

async function loadMoe(region: string, appId: string, url: string, vehiclesMap: Map<number, string>) {

  const res = await fetch(`${url}/${MOE_URL}`, {
    method: 'POST',
    body: new URLSearchParams({
      application_id: appId,
      distribution: 'damage',
      percentile: MOE_PERCENTILES.join(','),
    })
  })

  const data = await res.json() as MoeResponse;

  if (data.data.updated_at == lastMoeUpdated[region]) return

  const moeResult = new Map<string, { [percentile in typeof MOE_PERCENTILES[number]]: number }>()

  for (const element of Object.entries(data.data.distribution)) {
    const [key, value] = element;
    const tag = vehiclesMap.get(Number(key))
    if (!tag) continue
    const processed = tagProcessor(tag)
    if (!processed) {
      console.warn(`Unknown tag format: ${tag}`)
      continue
    }
    moeResult.set(processed, value);
  }

  const insertValues = Array.from(moeResult.entries()).map(([tag, distribution]) => ({
    region,
    tag,
    updatedAt: Math.round(new Date(data.data.updated_at * 1000).getTime() / 1000),
    dateTime: Math.round(new Date().getTime() / 1000),
    p20: distribution['20'],
    p40: distribution['40'],
    p55: distribution['55'],
    p65: distribution['65'],
    p75: distribution['75'],
    p85: distribution['85'],
    p95: distribution['95'],
    p100: distribution['100']
  }))

  console.log(`Inserting moe info [${insertValues.length}] for region ${region}...`);

  await clickhouse.insert({
    table: 'WOT.MoeInfo',
    values: insertValues,
    format: 'JSONEachRow'
  })

  console.log(`Moe info inserted for region ${region}`);


  lastMoeUpdated[region] = data.data.updated_at;
}

async function loadMastery(region: string, appId: string, url: string, vehiclesMap: Map<number, string>) {

  let updated = 0;
  const masteriesResult = new Map<string, Record<string, number>>()

  for (let i = 1; i <= 100; i += 10) {
    const percentiles = Array.from({ length: 10 }, (_, j) => (i + j).toString()).filter(p => Number(p) <= 100);

    const res = await fetch(`${url}/${MOE_URL}`, {
      method: 'POST',
      body: new URLSearchParams({
        application_id: appId,
        distribution: 'xp',
        percentile: percentiles.join(','),
      })
    })

    const data = await res.json() as MasteryResponse;

    if (data.data.updated_at == lastMasteriesUpdated[region]) return

    for (const [key, value] of Object.entries(data.data.distribution)) {
      const tag = vehiclesMap.get(Number(key))
      if (!tag) continue
      const processed = tagProcessor(tag)
      if (!processed) {
        console.warn(`Unknown tag format: ${tag}`)
        continue
      }

      if (!masteriesResult.has(processed)) masteriesResult.set(processed, {})
      const record = masteriesResult.get(processed)!

      for (const [percentile, count] of Object.entries(value))
        record[percentile] = count
    }

    updated = data.data.updated_at;
  }

  const insertValues = Array.from(masteriesResult.entries()).map(([tag, distribution]) => ({
    region,
    tag,
    updatedAt: Math.round(new Date(updated * 1000).getTime() / 1000),
    dateTime: Math.round(new Date().getTime() / 1000),
    ...Object.fromEntries(Object.entries(distribution).map(([k, v]) => [`p${k}`, v]))
  }))

  console.log(`Inserting mastery info [${insertValues.length}] for region ${region}...`);

  await clickhouse.insert({
    table: 'WOT.MasteryInfo',
    values: insertValues,
    format: 'JSONEachRow'
  })

  console.log(`Mastery info inserted for region ${region}`);

  lastMasteriesUpdated[region] = updated;
}


export async function load(region: string, appId: string, url: string) {

  const vehicles = await fetch(`${url}/${VEHICLE_URL}`, {
    method: 'POST',
    body: new URLSearchParams({
      application_id: appId,
      fields: 'tag'
    })
  })

  const vehiclesData = await vehicles.json() as VehicleResponse;
  const vehiclesMap = new Map<number, string>(Object.entries(vehiclesData.data).map(([id, { tag }]) => [Number(id), tag]))

  await loadMoe(region, appId, url, vehiclesMap);
  await loadMastery(region, appId, url, vehiclesMap);

}