import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { parseStringPromise } from "xml2js";
import { KPI, parseKpi, parsePrice, parseVehicleFilter, Price, processIcon, VehicleFilter } from "../utilsEquipments";
import { GameVersion, lcMessagesPath, XML } from "../utils";

type Equipment = {
  id: string
  userString?: string
  description?: string
  shortDescriptionSpecial?: string
  longDescriptionSpecial?: string
  icon: string
  price: Price
  notInShop?: 'true' | 'false'
  tags: string
  incompatibleTags: {
    installed?: string
  }
  vehicleFilter: {
    include?: VehicleFilter
    exclude?: VehicleFilter
  }
  tooltipSection: string
  kpi: KPI
}

type EquipmentsList = {
  [key: string]: Equipment
}

export async function load(root: string, region: string, version: GameVersion) {
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/artefacts.po`).text())

  const data = await Bun.file(`${root}/sources/res/scripts/item_defs/vehicles/common/equipments.xml`).text()
  const parsed = await parseStringPromise(data, { explicitArray: false }) as XML<EquipmentsList>
  const equipments = Object.keys(parsed.root).filter(k => k != 'xmlns:xmlref').map(key => ({ ...parsed.root[key], tag: key }))

  const price = equipments.map(e => parsePrice(e.price))
  const notInShop = equipments.map(e => e.notInShop === 'true')
  const incompatibleTags = equipments.map(e => e.incompatibleTags?.installed?.split(' ') || [])
  const vehicleFilter = equipments.map(e => ({
    include: parseVehicleFilter(e.vehicleFilter?.include),
    exclude: parseVehicleFilter(e.vehicleFilter?.exclude)
  }))

  const kpi = equipments.map(e => parseKpi(e.kpi))

  const res = equipments.map((d, i) => ({
    id: Number(d.id),
    tag: d.tag,

    name: !d.userString ? '' : i18n.getSingleLineTranslation(d.userString.split(':')[1], ''),
    description: !d.description ? '' : i18n.getSingleLineTranslation(d.description.split(':')[1], ''),
    shortDescription: !d.shortDescriptionSpecial ? '' : i18n.getSingleLineTranslation(d.shortDescriptionSpecial.split(':')[1], ''),
    longDescription: !d.longDescriptionSpecial ? '' : i18n.getSingleLineTranslation(d.longDescriptionSpecial.split(':')[1], ''),
    icon: processIcon(d.icon),
    priceAmount: price[i].price,
    priceCurrency: price[i].currency,
    tags: d.tags.split(' '),
    notInShop: notInShop[i],
    incompatibleTags: incompatibleTags[i],
    tooltipSection: d.tooltipSection,

    kpiSimple: kpi[i]?.simple ?? [],
    kpiAggregate: kpi[i]?.aggregate ?? [],

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

  console.log('Inserting Equipments...');
  await clickhouse.insert({
    table: 'WOT.Equipments',
    values: insertValues,
    format: 'JSONEachRow'
  })
  console.log(`Equipments inserted for: ${region}`);
}