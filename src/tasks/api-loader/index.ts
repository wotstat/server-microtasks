import { load as loadComp7Leaderboard } from "./comp7Leaderboard/leaderboard";

export type LoaderResult = {
  scheduleNextLoad: Date;
}

async function loadTask(region: string, baseUrl: string) {
  try {
    const result = await loadComp7Leaderboard(region, baseUrl)
    setTimeout(() => loadTask(region, baseUrl), result.scheduleNextLoad.getTime() - Date.now())
  } catch (error) {
    console.error(`Error loading leaderboard for region ${region}:`, error);
    setTimeout(() => loadTask(region, baseUrl), 30000)
  }
}

const REGION_URLS: Record<string, string> = {
  'RU': 'https://clientgw-ru.tanki.su',
  'EU': 'https://wgcg-eu.wargaming.net',
  'NA': 'https://wgcg-na.wargaming.net',
  'ASIA': 'https://wgcg-asia.wargaming.net',
  'CN': 'https://wgcg-cn360.wotgame.cn',
  'CT': 'https://wgcg-ct.wargaming.net',
}

export async function setup() {
  for (const [region, baseUrl] of Object.entries(REGION_URLS)) {
    await loadTask(region, baseUrl)
  }
}