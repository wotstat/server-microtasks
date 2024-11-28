import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { lcMessagesPath, type GameVersion } from "../utils"


export async function load(root: string, region: string, version: GameVersion) {
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/vehicle_customization.po`).text())

  const customization =
    Array.from(i18n.getAll().entries())
      .filter(([tag, value]) => !tag.endsWith('/long') &&
        !tag.endsWith('/description') &&
        !tag.endsWith('_description') &&
        !tag.endsWith('_desc') &&
        value != '?empty?')

  const insertValues = customization.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    gameVersionComp: version.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    tag: t[0],
    name: t[1]
  }))

  console.log('Inserting customization...');
  await clickhouse.insert({
    table: 'WOT.Customizations',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Customization inserted for: ${region}`);
}