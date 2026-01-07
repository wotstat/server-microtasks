import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { lcMessagesPath, XML, type GameVersion } from "../utils"
import { parseStringPromise } from "xml2js";
import { KPI, parseKpi, parsePrice, parseVehicleFilter, Price, processIcon, VehicleFilter } from "../utilsEquipments";

type Device = {
  id: string
  userString?: string
  shortDescriptionSpecial?: string
  longDescriptionSpecial?: string
  icon: string
  groupName: string
  price: Price
  tags: string
  notInShop?: 'true' | 'false'
  incompatibleTags: {
    installed?: string
  }
  vehicleFilter: {
    include?: VehicleFilter
    exclude?: VehicleFilter
  }
  archetype: string
  tooltipSection: string
  kpi: KPI
}

type DevicesList = {
  [key: string]: Device
}

export async function load(root: string, region: string, version: GameVersion) {
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/artefacts.po`).text())

  const data = await Bun.file(`${root}/sources/res/scripts/item_defs/vehicles/common/optional_devices.xml`).text()
  const parsed = await parseStringPromise(data, { explicitArray: false }) as XML<DevicesList>
  const devices = Object.keys(parsed.root).filter(k => k != 'xmlns:xmlref').map(key => ({ ...parsed.root[key], tag: key }))

  const price = devices.map(d => parsePrice(d.price))
  const notInShop = devices.map(d => d.notInShop === 'true')
  const incompatibleTags = devices.map(d => d.incompatibleTags?.installed?.split(' ') || [])
  const vehicleFilter = devices.map(d => ({
    include: parseVehicleFilter(d.vehicleFilter?.include),
    exclude: parseVehicleFilter(d.vehicleFilter?.exclude)
  }))

  const kpi = devices.map(d => parseKpi(d.kpi))

  const res = devices.map((d, i) => ({
    id: Number(d.id),
    tag: d.tag,

    name: !d.userString ? '' : i18n.getSingleLineTranslation(d.userString.split(':')[1], ''),
    shortDescription: !d.shortDescriptionSpecial ? '' : i18n.getSingleLineTranslation(d.shortDescriptionSpecial.split(':')[1], ''),
    longDescription: !d.longDescriptionSpecial ? '' : i18n.getSingleLineTranslation(d.longDescriptionSpecial.split(':')[1], ''),
    icon: processIcon(d.icon),
    groupName: d.groupName,
    priceAmount: price[i].price,
    priceCurrency: price[i].currency,
    tags: d.tags.split(' '),
    notInShop: notInShop[i],
    incompatibleTags: incompatibleTags[i],
    archetype: d.archetype,
    tooltipSection: d.tooltipSection,

    kpiSimple: kpi[i]!.simple,
    kpiAggregate: kpi[i]!.aggregate,

    vehicleIncludeMinLevel: vehicleFilter[i].include?.minLevel ?? null,
    vehicleIncludeMaxLevel: vehicleFilter[i].include?.maxLevel ?? null,
    vehicleIncludeTags: vehicleFilter[i].include?.tags ?? [],
    vehicleIncludeMandatoryTags: vehicleFilter[i].include?.mandatoryTags ?? [],
    vehicleIncludeNations: vehicleFilter[i].include?.nations ?? [],
    vehicleIncludeComponentFilters: vehicleFilter[i].include?.componentFilters ?? [],

    vehicleExcludeMinLevel: vehicleFilter[i].exclude?.minLevel ?? null,
    vehicleExcludeMaxLevel: vehicleFilter[i].exclude?.maxLevel ?? null,
    vehicleExcludeTags: vehicleFilter[i].exclude?.tags ?? [],
    vehicleExcludeMandatoryTags: vehicleFilter[i].exclude?.mandatoryTags ?? [],
    vehicleExcludeNations: vehicleFilter[i].exclude?.nations ?? [],
    vehicleExcludeComponentFilters: vehicleFilter[i].exclude?.componentFilters ?? []
  }))

  const insertValues = res.map(t => ({
    region,
    gameVersionFull: version.full,
    gameVersion: version.version,
    gameVersionHash: version.hash,
    gameVersionComp: version.comparable,
    datetime: Math.round(new Date().getTime() / 1000),

    ...t
  }))

  console.log('Inserting OptionalDevices...');
  await clickhouse.insert({
    table: 'WOT.OptionalDevices',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`OptionalDevices inserted for: ${region}`);
}