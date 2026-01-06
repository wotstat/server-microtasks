import { clickhouse } from "@/db";
import { GetText } from '@/utils/GetText'
import { lcMessagesPath, type GameVersion } from "../utils"
import { parseStringPromise } from "xml2js";

type XML<T> = {
  root: T
}

type VehicleFilter = {
  minLevel?: string
  maxLevel?: string
  tags?: string
  mandatoryTags?: string
  nations?: string
}

type KPI = {
  name: string
  value: string
}

type KPIAggregate = {
  name: string
  mul: (KPI & { vehicleTypes: string })[]
}

type Device = {
  id: string
  userString?: string
  shortDescriptionSpecial?: string
  longDescriptionSpecial?: string
  icon: string
  groupName: string
  price: {
    _?: string
    'equipCoin': ''
    'gold': ''
    'credits': ''
    'crystal': ''
  } | string
  tags: string
  notInShop?: 'true' | 'false'
  incompatibleTags: {
    installed?: string
  }
  vehicleFilter: {
    include?: { vehicle: VehicleFilter }
    exclude?: { vehicle: VehicleFilter }
  }
  archetype: string
  tooltipSection: string
  kpi: {
    mul?: KPI | KPI[]
    add?: KPI | KPI[]
    aggregateMul?: KPIAggregate | KPIAggregate[]
  }
}

type DevicesList = {
  [key: string]: Device
}

function tryParse(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

function parseVehicleFilter(filter: VehicleFilter | undefined) {
  if (!filter) return null;

  return {
    minLevel: tryParse(filter.minLevel),
    maxLevel: tryParse(filter.maxLevel),
    tags: filter.tags?.split(' ') ?? [],
    mandatoryTags: filter.mandatoryTags?.split(' ') ?? [],
    nations: filter.nations?.split(' ') ?? [],
  }
}

function parseKpi(kpi: Device['kpi']) {
  if (!kpi) return null;

  function toArray<T>(kpiPart: T | T[] | undefined): T[] {
    if (!kpiPart) return [];
    return Array.isArray(kpiPart) ? kpiPart : [kpiPart];
  }

  const mul = toArray(kpi.mul).map(k => ({ name: k.name, value: Number(k.value), type: 'mul' }))
  const add = toArray(kpi.add).map(k => ({ name: k.name, value: Number(k.value), type: 'add' }))
  const aggregateMul = toArray(kpi.aggregateMul).map(k => ({
    name: k.name,
    type: 'mul',
    mods: k.mul.map(m => ({
      name: m.name,
      value: Number(m.value),
      type: 'mul',
      vehicleTypes: m.vehicleTypes.split(' ')
    }))
  }))

  return {
    simple: [...mul, ...add].filter(t => t !== null),
    aggregate: aggregateMul.filter(t => t !== null)
  }
}

export async function load(root: string, region: string, version: GameVersion) {
  const i18n = new GetText(await Bun.file(`${root}/${lcMessagesPath(region)}/artefacts.po`).text())

  const data = await Bun.file(`${root}/sources/res/scripts/item_defs/vehicles/common/optional_devices.xml`).text()
  const parsed = await parseStringPromise(data, { explicitArray: false }) as XML<DevicesList>
  const devices = Object.keys(parsed.root).filter(k => k != 'xmlns:xmlref').map(key => ({ ...parsed.root[key], tag: key }))

  const price = devices.map(d => (typeof d.price === 'string' ?
    { price: Number(d.price), currency: 'credits' } :
    {
      price: Number(d.price._),
      currency: Object.keys(d.price).filter(k => k != '_')[0] || 'unknown'
    })
  )

  const notInShop = devices.map(d => d.notInShop === 'true')

  const incompatibleTags = devices.map(d => d.incompatibleTags?.installed?.split(' ') || [])
  const vehicleFilter = devices.map(d => ({
    include: parseVehicleFilter(d.vehicleFilter?.include?.vehicle),
    exclude: parseVehicleFilter(d.vehicleFilter?.exclude?.vehicle)
  }))

  const kpi = devices.map(d => parseKpi(d.kpi))

  function processIcon(icon: string) {
    const url = icon.split(' ').at(0) || ''

    const name = url.split('/').pop() || ''
    const parts = name.split('.')
    if (parts.length == 1) return name
    parts.pop()
    return parts.join('.')
  }

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
    kpiSimpleName: kpi[i]!.simple.map(k => k.name),
    kpiSimpleValue: kpi[i]!.simple.map(k => k.value),
    kpiSimpleType: kpi[i]!.simple.map(k => k.type),

    kpiAggregateName: kpi[i]!.aggregate.map(k => k.name),
    kpiAggregateType: kpi[i]!.aggregate.map(k => k.type),
    kpiAggregateModsName: kpi[i]!.aggregate.map(k => k.mods.map(m => m.name)),
    kpiAggregateModsValue: kpi[i]!.aggregate.map(k => k.mods.map(m => m.value)),
    kpiAggregateModsVehicleTypes: kpi[i]!.aggregate.map(k => k.mods.map(m => m.vehicleTypes)),

    vehicleIncludeMinLevel: vehicleFilter[i].include?.minLevel ?? null,
    vehicleIncludeMaxLevel: vehicleFilter[i].include?.maxLevel ?? null,
    vehicleIncludeTags: vehicleFilter[i].include?.tags ?? [],
    vehicleIncludeMandatoryTags: vehicleFilter[i].include?.mandatoryTags ?? [],

    vehicleExcludeMinLevel: vehicleFilter[i].exclude?.minLevel ?? null,
    vehicleExcludeMaxLevel: vehicleFilter[i].exclude?.maxLevel ?? null,
    vehicleExcludeTags: vehicleFilter[i].exclude?.tags ?? [],
    vehicleExcludeMandatoryTags: vehicleFilter[i].exclude?.mandatoryTags ?? [],
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