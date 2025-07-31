import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { filenameAndExtension, uploader } from "../utils";


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  const upload = uploader(game, version, bucket)

  const files = [...new Glob(`${root}/gui/maps/lootboxes/160x106/*.png`).scanSync()]

  for (const filePath of files) {
    const fileContent = await Bun.file(filePath).bytes()


    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);

    const webpBuffer = await sharp(fileContent).webp({ quality: 80, alphaQuality: 50 }).toBuffer()
    await upload(`lootboxes/small/${name}.png`, fileContent)
    await upload(`lootboxes/small/${name}.webp`, webpBuffer)


    let hasLargeFile = false
    for (const size of ['s600x450', 's400x300', 's360x270', 's296x222', 's180x135', 's160x120']) {
      const largeFile = Bun.file(`${root}/gui/maps/icons/quests/bonuses/${size}/${name}.png`)

      if (await largeFile.exists()) {
        const largeContent = await sharp(await largeFile.bytes()).resize(600, 450).toBuffer()
        const largeWebpBuffer = await sharp(largeContent).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

        await upload(`lootboxes/large/${name}.png`, largeContent)
        await upload(`lootboxes/large/${name}.webp`, largeWebpBuffer)

        hasLargeFile = true
        break
      }
    }

    if (!hasLargeFile) {
      const upscaleBuffer = await sharp(fileContent)
        .resize({
          width: 600,
          height: 450,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .sharpen()
        .toBuffer()

      const upscaleWebpBuffer = await sharp(upscaleBuffer).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

      await upload(`lootboxes/large/${name}.png`, upscaleBuffer)
      await upload(`lootboxes/large/${name}.webp`, upscaleWebpBuffer)
    }
  }
}