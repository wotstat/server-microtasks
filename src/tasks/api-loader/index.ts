import { load as loadComp7Leaderboard } from "./comp7Leaderboard/leaderboard";
import { load as loadGoldwagon } from "./goldwagon/loaderGoldwagon";
import { schedule } from "node-cron";

export type LoaderResult = {
  scheduleNextLoad: Date;
}

async function loadTask(loader: () => Promise<LoaderResult>, name: string) {
  try {
    const result = await loader()
    setTimeout(() => loadTask(loader, name), result.scheduleNextLoad.getTime() - Date.now())
  } catch (error) {
    console.error(`Error loading ${name}:`, error);
    setTimeout(() => loadTask(loader, name), 30000)
  }
}

const CRON_TASKS: [string, (region: string, baseUrl: string) => void][] = [
  ['* * * * * *', (region, baseUrl) => loadGoldwagon(region, baseUrl)],
]

const REGION_URLS: Record<string, string> = {
  'RU': 'https://clientgw-ru.tanki.su',
  'RPT': 'https://clientgw-rpt.tanki.su',
  'EU': 'https://wgcg-eu.wargaming.net',
  'NA': 'https://wgcg-na.wargaming.net',
  'ASIA': 'https://wgcg-asia.wargaming.net',
  'CN': 'https://wgcg-cn360.wotgame.cn',
  'CT': 'https://wgcg-ct.wargaming.net',
}

export async function setup() {
  for (const [region, baseUrl] of Object.entries(REGION_URLS)) {
    await loadTask(() => loadComp7Leaderboard(region, baseUrl), `leaderboard_${region}`)
  }

  for (const [cron, task] of CRON_TASKS) {
    schedule(cron, async () => {
      for (const [region, baseUrl] of Object.entries(REGION_URLS)) { task(region, baseUrl) }
    })
  }
}