import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { filenameAndExtension, uploader } from "../utils";


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  const upload = uploader(game, version, bucket)

  const files = [...new Glob(`${root}/gui/maps/shop/shells/360x270/*.png`).scanSync()]
  for (const filePath of files) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`shells/${name}.png`, fileContent)
    await upload(`shells/${name}.webp`, webpBuffer)
  }
}