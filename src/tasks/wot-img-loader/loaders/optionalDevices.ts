import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '../../../utils/assetsUploader'
import { filenameAndExtension } from '../utils'
import { clickhouse } from '@/db'


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  console.log('Loading optionalDevices...')

  const region = game === 'mt' ? 'RU' : 'EU'

  const data = await clickhouse.query({
    query: `
      select distinct icon from WOT.OptionalDevicesLatest where region = '${region}'
      union distinct
      select distinct icon from WOT.EquipmentsLatest where region = '${region}'
  `})
  const icons = new Set((await data.json<{ icon: string }>()).data.map(item => item.icon))

  const upload = uploader(game, version, bucket)


  const small = [...new Glob(`${root}/gui/maps/icons/artefact/*.png`).scanSync()]
  const medium = [...new Glob(`${root}/gui/maps/shop/artefacts/180x135/*.png`).scanSync()]
  const large = [...new Glob(`${root}/gui/maps/shop/artefacts/360x270/*.png`).scanSync()]
  const extraLarge = [...new Glob(`${root}/gui/maps/shop/artefacts/600x450/*.png`).scanSync()]

  const fallbackMedium = [...new Glob(`${root}/gui/maps/icons/quests/bonuses/s180x135/*.png`).scanSync()]
  const fallbackLarge = [...new Glob(`${root}/gui/maps/icons/quests/bonuses/s360x270/*.png`).scanSync()]
  const fallbackExtraLarge = [...new Glob(`${root}/gui/maps/icons/quests/bonuses/s600x450/*.png`).scanSync()]

  const targetIcons = icons.keys().map(icon => ({
    icon,
    small: small.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    medium: medium.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackMedium.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    large: large.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon),
    extraLarge: extraLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon) || fallbackExtraLarge.find(filePath => filenameAndExtension(filePath).nameWithoutExt === icon)
  }))

  for (const icon of targetIcons) {
    const smallFile = icon.small ? Bun.file(icon.small) : null
    const mediumFile = icon.medium ? Bun.file(icon.medium) : null
    const largeFile = icon.large ? Bun.file(icon.large) : null
    const extraLargeFile = icon.extraLarge ? Bun.file(icon.extraLarge) : null

    if (!smallFile && !mediumFile && !largeFile && !extraLargeFile) continue

    const smallFileBytes = smallFile?.bytes() ??
      mediumFile?.image().resize(48, 48, { fit: 'inside' }).bytes() ??
      largeFile?.image().resize(48, 48, { fit: 'inside' }).bytes() ??
      extraLargeFile?.image().resize(48, 48, { fit: 'inside' }).bytes()

    const mediumFileBytes = mediumFile?.bytes() ??
      largeFile?.image().resize(180, 135).bytes() ??
      extraLargeFile?.image().resize(180, 135).bytes() ??
      smallFile?.image().resize(180, 135, { fit: 'inside' }).bytes()

    const largeFileBytes = largeFile?.bytes() ??
      mediumFile?.image().resize(360, 270).bytes() ??
      extraLargeFile?.image().resize(360, 270).bytes() ??
      smallFile?.image().resize(360, 270, { fit: 'inside' }).bytes()

    const extraLargeFileBytes = extraLargeFile?.bytes() ??
      largeFile?.image().resize(600, 450).bytes() ??
      mediumFile?.image().resize(600, 450).bytes() ??
      smallFile?.image().resize(600, 450, { fit: 'inside' }).bytes()

    const sizes = {
      small: smallFileBytes,
      medium: mediumFileBytes,
      large: largeFileBytes,
      extraLarge: extraLargeFileBytes
    }

    for (const [size, fileBytes] of Object.entries(sizes)) {
      if (!fileBytes) continue

      const bytes = await fileBytes
      await upload(`optionalDevices/${size}/${icon.icon}.png`, bytes)
      await upload(`optionalDevices/${size}/${icon.icon}.webp`, await new Bun.Image(bytes).webp({ quality: 80 }).bytes())
    }

  }
}
