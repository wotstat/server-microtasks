import { clickhouse } from "@/db";
import { type GameVersion } from "../utils"
import { parseStringPromise } from 'xml2js';


export async function load(root: string, region: string, version: GameVersion) {
  const pathsFile = Bun.file(`${root}/sources/paths.xml`);

  if (!pathsFile.exists()) return

  const paths = await parseStringPromise(await pathsFile.text(), { explicitArray: false, trim: true })

  const modsPath = paths['root']['Paths']['Path'].find((t: any) => t['_'].match(/\.\/mods\/.*/));

  if (!modsPath) return console.warn(`No mods path found`)

  const modsPathValue = modsPath['_'];
  const modsFolderName = modsPathValue.replace('./mods/', '')


  console.log('Inserting mods folder path...');
  await clickhouse.insert({
    table: 'WOT.GameVersions',
    values: [
      {
        region,
        gameVersionFull: version.full,
        gameVersion: version.version,
        gameVersionHash: version.hash,
        gameVersionComp: version.comparable,
        datetime: Math.round(new Date().getTime() / 1000),
        modsFolderName: modsFolderName,
      }
    ],
    format: 'JSONEachRow'
  })
  console.log(`Mods folder path inserted for: ${region}`);

}