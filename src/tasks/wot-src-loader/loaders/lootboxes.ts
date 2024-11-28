import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { lcMessagesPath, type GameVersion } from "../utils"


export async function load(root: string, region: string, version: GameVersion) {
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/lootboxes.po`).text())

  const lootboxes =
    Array.from(i18n.getAll().entries())
      .filter(t => t[0].includes('userName/'))

  const insertValues = lootboxes.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    gameVersionComp: version.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    tag: t[0].replace('userName/', ''),
    name: t[1].replaceAll('\n', ' ').replaceAll('\\n', '')
  }))


  console.log('Inserting lootboxes...');
  await clickhouse.insert({
    table: 'WOT.Lootboxes',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Lootboxes inserted for: ${region}`);

}