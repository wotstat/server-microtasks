import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { filenameAndExtension, uploader } from "../utils";


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  const upload = uploader(game, version, bucket)

  const minimapFiles = [...new Glob(`${root}/gui/maps/icons/map/*.png`).scanSync()]
  for (const filePath of minimapFiles) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);

    const webpBuffer = await sharp(fileContent).webp({ quality: 90, alphaQuality: 0 }).toBuffer()
    await upload(`arenas/minimap/${name}.png`, fileContent)
    await upload(`arenas/minimap/${name}.webp`, webpBuffer)
  }

  const statsFiles = [...new Glob(`${root}/gui/maps/icons/map/stats/*.png`).scanSync()]
  for (const filePath of statsFiles) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);

    const webpBuffer = await sharp(fileContent).webp({ quality: 80, alphaQuality: 0 }).toBuffer()
    await upload(`arenas/stats/${name}.png`, fileContent)
    await upload(`arenas/stats/${name}.webp`, webpBuffer)
  }
}