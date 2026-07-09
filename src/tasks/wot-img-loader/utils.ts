
export function filename(path: string) {
  return path.split('/').at(-1) ?? ''
}

export function filenameAndExtension(path: string) {
  const name = filename(path)
  const ext = path.split('.').pop()?.toLowerCase()
  const nameWithoutExt = name.split('.').slice(0, 1).join('.')
  return { name, ext, nameWithoutExt }
}

export type Region = 'EU' | 'NA' | 'RU' | 'PT_RU' | 'CN' | 'ASIA' | 'CT'
export type Ctx<T> = Record<Region, T>