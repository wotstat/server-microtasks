
export type VehicleFilter = {
  minLevel?: string
  maxLevel?: string
  tags?: string
  mandatoryTags?: string
  nations?: string
  componentFilters?: {
    [component: string]: {
      [key: string]: string
    }
  }
}

export type KPISimple = {
  name: string
  value: string
}

export type KPIAggregate = {
  name: string
  mul: (KPISimple & { vehicleTypes: string })[]
}

export type KPI = {
  mul?: KPISimple | KPISimple[]
  add?: KPISimple | KPISimple[]
  aggregateMul?: KPIAggregate | KPIAggregate[]
}

export function tryParseNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

export function parseVehicleFilter(filter: VehicleFilter | undefined) {
  if (!filter) return null;

  const componentFilters = filter.componentFilters || {}

  return {
    minLevel: tryParseNumber(filter.minLevel),
    maxLevel: tryParseNumber(filter.maxLevel),
    tags: filter.tags?.split(' ') ?? [],
    mandatoryTags: filter.mandatoryTags?.split(' ') ?? [],
    nations: filter.nations?.split(' ') ?? [],
    componentFilters: Object.entries(componentFilters)
      .map(([component, compFilter]) => Object.entries(compFilter)
        .map(([key, value]) => ({ component, key, value })))
  }
}

export function parseKpi(kpi: KPI) {
  if (!kpi) return null;

  function toArray<T>(kpiPart: T | T[] | undefined): T[] {
    if (!kpiPart) return [];
    return Array.isArray(kpiPart) ? kpiPart : [kpiPart];
  }

  const mul = toArray(kpi.mul).map(k => ({ name: k.name, type: 'mul', value: Number(k.value) }))
  const add = toArray(kpi.add).map(k => ({ name: k.name, type: 'add', value: Number(k.value) }))
  const aggregateMul = toArray(kpi.aggregateMul).map(k => ({
    name: k.name,
    type: 'mul',
    restrictions: k.mul.map(m => ({
      name: m.name,
      value: Number(m.value),
      vehicleTypes: m.vehicleTypes.split(' ')
    }))
  }))

  return {
    simple: [...mul, ...add].filter(t => t !== null),
    aggregate: aggregateMul.filter(t => t !== null)
  }
}

export type Price = {
  _?: string
  'equipCoin': ''
  'gold': ''
  'credits': ''
  'crystal': ''
} | string

export function parsePrice(price: Price) {
  if (typeof price === 'string') {
    return { price: Number(price), currency: 'credits' }
  } else {
    const currency = Object.keys(price).filter(k => k != '_')[0] || 'unknown'
    return { price: Number(price[currency as keyof Price]), currency }
  }
}