import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { uploader } from "../../../utils/assetsUploader";
import { filenameAndExtension } from "../utils";

function intersect<T>(...sets: Set<T>[]): Set<T> {
  if (sets.length === 0) return new Set<T>()
  return sets.reduce((acc, set) => {
    const result = new Set<T>()
    for (const item of acc) {
      if (set.has(item)) {
        result.add(item)
      }
    }
    return result
  })
}

export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  const upload = uploader(game, version, bucket)

  const extraLarge = [...new Glob(`${root}/gui/maps/icons/tankmen/skills/dialogs/*.png`).scanSync()]
  const big = [...new Glob(`${root}/gui/maps/icons/tankmen/skills/big/*.png`).scanSync()]

  const intersectedNames = intersect(
    new Set(extraLarge.map(filePath => filenameAndExtension(filePath).nameWithoutExt)),
    new Set(big.map(filePath => filenameAndExtension(filePath).nameWithoutExt)),
  )

  for (const filePath of extraLarge) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    if (!intersectedNames.has(name)) continue;

    const fileContent = await Bun.file(filePath).bytes()
    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`skills/large/${name}.png`, fileContent)
    await upload(`skills/large/${name}.webp`, webpBuffer)
  }

  for (const filePath of big) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    if (!intersectedNames.has(name)) continue;

    const fileContent = await Bun.file(filePath).bytes()
    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`skills/medium/${name}.png`, fileContent)
    await upload(`skills/medium/${name}.webp`, webpBuffer)
  }
}