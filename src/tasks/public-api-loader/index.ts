import { load as moeAndMasteryLoad } from "./loaders/moeAndMastery";

const APPLICATION_ID_LESTA = Bun.env.APPLICATION_ID_LESTA
const APPLICATION_ID_WG = Bun.env.APPLICATION_ID_WG
const LESTA_API_URL = 'https://api.tanki.su'
const EU_API_URL = 'https://api.worldoftanks.eu'
const NA_API_URL = 'https://api.worldoftanks.com'
const ASIA_API_URL = 'https://api.worldoftanks.asia'

export async function load() {

  const regions = [
    { name: 'RU', url: LESTA_API_URL, appId: APPLICATION_ID_LESTA },
    { name: 'EU', url: EU_API_URL, appId: APPLICATION_ID_WG },
    { name: 'NA', url: NA_API_URL, appId: APPLICATION_ID_WG },
    { name: 'ASIA', url: ASIA_API_URL, appId: APPLICATION_ID_WG },
  ]

  for (const region of regions) {
    try {
      await moeAndMasteryLoad(region.name, region.appId, region.url)
    } catch (error) {
      console.error(`Error loading moe and mastery info for region ${region.name}:`, error);
    }
  }
}