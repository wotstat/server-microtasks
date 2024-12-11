import { parseStringPromise } from 'xml2js';

export type GameVersion = {
  full: string
  version: string
  hash: string
  comparable: number
}

export async function parseGameVersion(root: string): Promise<GameVersion> {
  const versionText = await Bun.file(`${root}/sources/version.xml`).text()
  const versionMeta = await parseStringPromise(versionText, { explicitArray: false, trim: true })
  const version = versionMeta['version.xml'].version

  const main = version.split(' ')[0] as string
  const hash = version.split(' ')[1].replace('#', '')

  const parts = main.split('.').slice(1)
  const comp = Number.parseInt(parts.map(t => t.padStart(2, '0')).join('')) * 1e5 + Number.parseInt(hash)

  return {
    full: version,
    version: parts.join('.'),
    hash,
    comparable: comp
  }
}

export function lcMessagesPath(branch: string) {
  if (branch == 'PT_RU' || branch == 'RU') return `sources/res/text/ru/lc_messages`
  return `sources/res/text/lc_messages`
}
