import { clickhouse } from "@/db"
import { GetText } from "@/utils/GetText"
import { parseStringPromise } from 'xml2js'
import { lcMessagesPath, type GameVersion } from "../utils"
import { Glob } from "bun";

type XML<T> = {
  root: T
}

type Vehicle = {
  id: string,
  userString: string,
  shortUserString?: string,
  description: string,
  price: string,
  tags: string,
  level: string
}

function isTank(obj: unknown): obj is Vehicle {
  if (typeof obj !== 'object' || obj === null) return false
  if (!('id' in obj)) return false
  if (!('userString' in obj)) return false
  if (!('description' in obj)) return false
  if (!('price' in obj)) return false
  if (!('tags' in obj)) return false
  if (!('level' in obj)) return false
  return true
}

type VehicleList = {
  [key: string]: unknown
}

const i18nCache = new Map<string, GetText>()
async function getLocalizedString(root: string, tag: string, region: string) {

  const [target, key] = tag.split(':')
  if (!i18nCache.has(target)) {
    i18nCache.set(target, new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/${target.replace('#', '')}.po`).text()))
  }

  return i18nCache.get(target)!.getTranslation(key, '')
}

const typeSet = new Set(['lightTank', 'mediumTank', 'heavyTank', 'AT-SPG', 'SPG'] as const)
const roleSet = new Set(['role_HT_support', 'role_LT_wheeled', 'role_MT_support', 'role_ATSPG_universal', 'role_LT_universal', 'role_HT_break', 'role_HT_universal', 'role_SPG', 'role_SPG_flame', 'role_ATSPG_assault', 'role_ATSPG_sniper', 'role_SPG_assault', 'role_MT_assault', 'role_HT_assault', 'role_MT_sniper', 'role_MT_universal', 'role_ATSPG_support'] as const)

function getTypeFromTags(tags: string[]) {
  for (const tag of tags) {
    if (typeSet.has(tag as any)) return tag
  }
  return 'unknown'
}

function getRoleFromTags(tags: string[]) {
  for (const tag of tags) {
    if (roleSet.has(tag as any)) return tag
  }
  return null
}

async function process(root: string, region: string) {

  i18nCache.clear()
  const glob = new Glob(`${root}/sources/res/scripts/item_defs/vehicles/*/list.xml`);

  const result: {
    tag: string,
    nation: string,
    type: string,
    role: string,
    level: number,
    name: string,
    shortName: string
  }[] = []

  for (const file of glob.scanSync()) {
    const nation = file.split('/')[file.split('/').length - 2]

    const data = await Bun.file(file).text()
    const parsed = await parseStringPromise(data, { explicitArray: false }) as XML<VehicleList>

    const tanks = await Promise.all(Object.entries(parsed.root)
      .filter(([key, value]) => isTank(value))
      .map(async ([key, value]) => {
        const tank = value as Vehicle
        const tags = tank.tags.split(' ')
        const userString = await getLocalizedString(root, tank.userString, region)
        return {
          tag: `${nation}:${key}`,
          nation,
          type: getTypeFromTags(tags),
          role: getRoleFromTags(tags) ?? '',
          level: Number.parseInt(tank.level),
          name: userString,
          shortName: tank.shortUserString ? await getLocalizedString(root, tank.shortUserString, region) : userString,
        }
      }))

    result.push(...tanks)
  }

  return result
}


export async function load(root: string, region: string, version: GameVersion) {
  const res = await process(root, region)

  const insertValues = res.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    gameVersionComp: version.comparable,
    datetime: Math.round(new Date().getTime() / 1000),
    ...t
  }))


  console.log('Inserting vehicles...');
  await clickhouse.insert({
    table: 'WOT.Vehicles',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Vehicles inserted for: ${region}`);

}