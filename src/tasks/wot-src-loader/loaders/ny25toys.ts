import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { lcMessagesPath, type GameVersion } from "../utils"


export async function load(root: string, region: string, version: GameVersion) {

  const toysFile = Bun.file(`${root}/${lcMessagesPath(region)}/new_year.ny_toys.po`)

  if (!toysFile.exists()) return

  const i18n = new GetText(await toysFile.text())

  const toys =
    Array.from(i18n.getAll().entries())
      .map(t => ([t[0].match(/decorations\/toy_(.*)\/name/), t[1]] as const))
      .filter(t => t[0] !== null)
      .map(t => [t[0]![1], t[1]])

  const insertValues = toys.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    gameVersionComp: version.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    tag: `ny25_${t[0]}`,
    name: t[1]
  }))


  console.log('Inserting toys...');
  await clickhouse.insert({
    table: 'WOT.Toys',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Toys inserted for: ${region}`);

}