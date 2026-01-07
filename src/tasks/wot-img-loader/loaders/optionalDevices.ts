import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { uploader } from "../../../utils/assetsUploader";
import { filenameAndExtension } from "../utils";
import { clickhouse } from "@/db";


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  console.log('Loading optionalDevices...');

  const region = game === 'mt' ? 'RU' : 'EU'

  const data = await clickhouse.query({ query: `select distinct icon from WOT.OptionalDevicesLatest where region = '${region}'` })
  const icons = new Set((await data.json<{ icon: string }>()).data.map(item => item.icon))

  const upload = uploader(game, version, bucket)

  const sizes = [
    { name: 'medium', size: '180x135' },
    { name: 'large', size: '360x270' },
    { name: 'extraLarge', size: '600x450' }
  ]

  for (const size of sizes) {
    const files = [...new Glob(`${root}/gui/maps/shop/artefacts/${size.size}/*.png`).scanSync()]
    for (const filePath of files) {
      const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
      if (!icons.has(name)) continue;

      const fileContent = await Bun.file(filePath).bytes()

      const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
      await upload(`optionalDevices/${size.name}/${name}.png`, fileContent)
      await upload(`optionalDevices/${size.name}/${name}.webp`, webpBuffer)
    }
  }

  const small = [...new Glob(`${root}/gui/maps/icons/artefact/*.png`).scanSync()]
  for (const filePath of small) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    if (!icons.has(name)) continue;

    const fileContent = await Bun.file(filePath).bytes()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`optionalDevices/small/${name}.png`, fileContent)
    await upload(`optionalDevices/small/${name}.webp`, webpBuffer)
  }
}