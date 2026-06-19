import { GameVersion } from "@/tasks/wot-src-loader/utils"
import { S3Client } from "@aws-sdk/client-s3";
import { Ctx, filenameAndExtension } from "../utils";
import { Glob } from "bun";
import { clickhouse } from "@/db"
import { uploader } from "@/utils/assetsUploader";
import sharp from "sharp";


type Context = {
  season: string | null,
  seasonsInYear?: number,
  version: string
} | null

export async function contextPrepare(root: string, region: string, version: GameVersion): Promise<Context> {
  const versionName = await Bun.file(`${root}/.version_name`).text()

  if (region === 'RU') {
    const common = await Bun.file(`${root}/sources/res/scripts/common/comp7_common.py`).text()

    const currentSeason = /COMP7_CURRENT_SEASON = (\d+)/.exec(common)?.[1]
    const maskotId = /COMP7_MASKOT_ID = '(\d+)'/.exec(common)?.[1]

    return {
      season: `comp7_${maskotId}_${currentSeason}`,
      version: versionName.trim()
    }
  }

  if (region === 'EU') {
    const common = await Bun.file(`${root}/sources/res/comp7/scripts/common/comp7_common_const.py`).text()

    const seasonsInYear = /SEASONS_IN_YEAR = (\d+)/.exec(common)?.[1]
    const maskotId = /COMP7_MASKOT_ID = '(\d+)'/.exec(common)?.[1]

    return {
      season: `comp7_${maskotId}`,
      seasonsInYear: seasonsInYear ? parseInt(seasonsInYear) : undefined,
      version: versionName.trim()
    }
  }

  return null
}

async function process(path: string, size: string, season: string, upload: ReturnType<typeof uploader>) {
  const files = [...new Glob(path).scanSync()]
  for (const filePath of files) {
    const fileContent = await Bun.file(filePath).bytes()
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);

    const webpBuffer = await sharp(fileContent).webp({ quality: 85, alphaQuality: 80 }).toBuffer()
    await upload(`comp7/ranks/${season}/${size}/${name}.png`, fileContent)
    await upload(`comp7/ranks/${season}/${size}/${name}.webp`, webpBuffer)
    await upload(`comp7/ranks/latest/${size}/${name}.png`, fileContent)
    await upload(`comp7/ranks/latest/${size}/${name}.webp`, webpBuffer)
  }
}

let lastMtUploadKey = ''
let lastWotUploadKey = ''
export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client, hasChanges: boolean, ctx: Ctx<Context>) {
  const upload = uploader(game, version, bucket)
  const assetsVersion = await Bun.file(`${root}/.metadata_version`).text()

  if (game == 'mt') {
    const context = ctx['RU']
    if (!context || !context.season) return

    const assetsVersionMajor = assetsVersion.split('.').slice(0, 2).join('.')
    const contextVersionMajor = context.version.split('.').slice(0, 2).join('.')

    if (assetsVersionMajor !== contextVersionMajor)
      return console.warn(`Assets version (${assetsVersionMajor}) and context version (${contextVersionMajor}) major versions are different, skip loading comp7 images`)

    const uploadKey = `${context.season}-${version}`
    if (lastMtUploadKey == uploadKey) return

    await process(`${root}/gui/maps/icons/comp7/ranks/420/*.png`, 'large', context.season, upload)
    await process(`${root}/gui/maps/icons/comp7/ranks/150/*.png`, 'medium', context.season, upload)
    await process(`${root}/gui/maps/icons/comp7/ranks/84/*.png`, 'small', context.season, upload)
    lastMtUploadKey = uploadKey

  } else {
    const context = ctx['EU']
    if (!context || !context.season || !context.seasonsInYear) return console.warn(`Context for EU region is not valid, skip loading comp7 images`)

    const assetsVersionMinor = assetsVersion.split('.').slice(0, 3).join('.')
    const contextVersionMinor = context.version.split('.').slice(0, 3).join('.')

    if (assetsVersionMinor !== contextVersionMinor)
      return console.warn(`Assets version (${assetsVersionMinor}) and context version (${contextVersionMinor}) minor versions are different, skip loading comp7 images`)

    const uploadKey = `${version}`
    if (lastWotUploadKey == uploadKey) return

    const seasons = ['first', 'second', 'third', 'fourth', 'fifth'].slice(0, context.seasonsInYear)

    for (let i = 0; i < seasons.length; i++) {
      const season = seasons[i]
      const seasonName = `${context.season}_${i + 1}`

      if (!Bun.file(`${root}/gui/maps/icons/comp7/ranks/${season}/420`).exists())
        return console.error(`Path ${root}/gui/maps/icons/comp7/ranks/${season}/420 does not exist, skip loading comp7 images for season ${season}`)

      await process(`${root}/gui/maps/icons/comp7/ranks/${season}/420/*.png`, 'large', seasonName, upload)
      await process(`${root}/gui/maps/icons/comp7/ranks/${season}/150/*.png`, 'medium', seasonName, upload)
      await process(`${root}/gui/maps/icons/comp7/ranks/${season}/84/*.png`, 'small', seasonName, upload)
    }

    lastWotUploadKey = uploadKey

    // const res = await clickhouse.query({
    //   query: `select argMax(gameVersion, dateTime) as version, argMax(season, dateTime) as season from WOT.Event_OnComp7Info where region in ('EU', 'NA')`
    // })
    // const data = await res.json<{ version: string, season: string }>()
    // const { version: latestVersion, season } = data.data[0]
    // const latestComp7Minor = latestVersion.split('_')[1]
    // const assetsVersionMinor = assetsVersion.split('.').slice(0, 3).join('.')

    // if (latestComp7Minor != assetsVersionMinor) return

    // const uploadKey = `${season}-${version}`
    // if (lastWotUploadKey == uploadKey) return console.info(`Comp7 images for season ${season} and version ${version} already uploaded, skip`)

    // await process(`${root}/gui/maps/icons/comp7/ranks/420/*.png`, 'large', season, upload)
    // await process(`${root}/gui/maps/icons/comp7/ranks/150/*.png`, 'medium', season, upload)
    // await process(`${root}/gui/maps/icons/comp7/ranks/84/*.png`, 'small', season, upload)

    // lastWotUploadKey = uploadKey
  }
}