import { Glob } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'
import { uploader } from '../../../utils/assetsUploader'
import { filenameAndExtension } from '../utils'


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  const upload = uploader(game, version, bucket)

  const files = [...new Glob(`${root}/gui/maps/shop/shells/360x270/*.png`).scanSync()]
  for (const filePath of files) {
    const file = Bun.file(filePath)

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath)

    const webpBytes = await file.image().webp({ quality: 80 }).bytes()
    await upload(`shells/${name}.png`, await file.bytes())
    await upload(`shells/${name}.webp`, webpBytes)
  }
}
