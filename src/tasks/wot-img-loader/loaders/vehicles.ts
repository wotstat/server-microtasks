import { Glob } from "bun"
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { filenameAndExtension, uploader } from "../utils";


export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: S3Client) {

  console.log(`Loading vehicles...`);

  const upload = uploader(game, version, bucket)


  const shop = [...new Glob(`${root}/gui/maps/shop/vehicles/600x450/*.png`).scanSync()]
  for (const filePath of shop) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    const targetName = name.toLowerCase()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80, alphaQuality: 70 }).toBuffer()
    await upload(`vehicles/shop/${targetName}.png`, fileContent)
    await upload(`vehicles/shop/${targetName}.webp`, webpBuffer)
  }
  console.log(`Vehicles shop images loaded`);


  const small = [...new Glob(`${root}/gui/maps/icons/vehicle/small/*-*.png`).scanSync()]
  for (const filePath of small) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    const targetName = name.split('-').slice(1).join('-').toLowerCase()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`vehicles/small/${targetName}.png`, fileContent)
    await upload(`vehicles/small/${targetName}.webp`, webpBuffer)
  }

  const smallNoImage = Bun.file(`${root}/gui/maps/icons/vehicle/small/noImage.png`);
  if (await smallNoImage.exists()) {
    const fileContent = await smallNoImage.bytes()
    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`vehicles/small/no-image.png`, fileContent)
    await upload(`vehicles/small/no-image.webp`, webpBuffer)
  }
  console.log(`Vehicles small images loaded`);


  const medium = [...new Glob(`${root}/gui/maps/icons/vehicle/420x307/*.png`).scanSync()]
  for (const filePath of medium) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    const targetName = name.toLowerCase()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`vehicles/medium/${targetName}.png`, fileContent)
    await upload(`vehicles/medium/${targetName}.webp`, webpBuffer)
  }

  console.log(`Vehicles medium images loaded`);


  const preview = [...new Glob(`${root}/gui/maps/icons/vehicle/*-*.png`).scanSync()]
  for (const filePath of preview) {
    const fileContent = await Bun.file(filePath).bytes()

    const { nameWithoutExt: name, ext } = filenameAndExtension(filePath);
    const targetName = name.split('-').slice(1).join('-').toLowerCase()

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`vehicles/preview/${targetName}.png`, fileContent)
    await upload(`vehicles/preview/${targetName}.webp`, webpBuffer)
  }

  const previewNoImage = Bun.file(`${root}/gui/maps/icons/vehicle/noImage.png`);
  if (await previewNoImage.exists()) {
    const fileContent = await previewNoImage.bytes()
    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`vehicles/preview/no-image.png`, fileContent)
    await upload(`vehicles/preview/no-image.webp`, webpBuffer)
  }


  console.log(`Vehicles preview images loaded`);
}