import { Glob } from "bun"
import { S3Client as AwsS3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { uploader } from "../../../utils/assetsUploader";
import { filenameAndExtension } from "../utils";
import { createSpriteAtlas } from "../spriteAtlas";
import { S3Client } from 'bun'

type Uploader = ReturnType<typeof uploader>

async function loadShop(root: string, upload: Uploader) {
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
}

async function loadSmall(root: string, upload: Uploader) {
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

}

async function loadMedium(root: string, upload: Uploader) {
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
}

async function loadPreview(root: string, upload: Uploader) {
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

async function generateSmallSprite(root: string, game: 'mt' | 'wot', upload: Uploader, resolutions: number[]) {
  const maxResolution = Math.max(...resolutions);

  async function spriteFixer(tag: string, img: string | Buffer): Promise<string | Buffer> {

    switch (tag) {
      case 'pl17_ds_pzlnz_sh':
      case 's14_ikv_103_sh':
      case 'gb107_cavalier_sh':
      case 'f43_amc_35_sh':
      case 'ch24_type64_sh':
      case 'a72_t25_2_sh':
      case 'g24_vk3002db_sh':
      case 'r46_kv-13_sh':
        const result = sharp(img)
        const metadata = await result.metadata();

        result.extract({ left: 50, top: 0, width: metadata.width - 50, height: metadata.height })
        return result.toBuffer()

      default: break;
    }

    return img
  }

  const bunClient = new S3Client({ endpoint: Bun.env.AWS_ENDPOINT_URL });

  function imageName(path: string) {
    const { nameWithoutExt: name, ext } = filenameAndExtension(path);
    return name.split('-').slice(1).join('-').toLowerCase();
  }

  async function loadExistingKeys() {

    let continuationToken = undefined;
    let data: string[] = []

    do {
      const list = await bunClient.list({
        prefix: `${game}/latest/vehicles/small/`,
        continuationToken,
        maxKeys: 1000
      });

      continuationToken = list.nextContinuationToken;
      data.push(...list.contents?.map(item => item.key) ?? []);

    } while (continuationToken)

    return data
  }

  const keys = (await loadExistingKeys()).filter(key => key.endsWith('.png'));
  const small = [...new Glob(`${root}/gui/maps/icons/vehicle/small/*-*.png`).scanSync()]

  const res = new Set(small.map(imageName))
    .add('no-image')
  const needToLoad = keys.filter(t => !res.has(filenameAndExtension(t).nameWithoutExt))


  const loaded = new Map<string, Buffer | string>();
  for (const element of needToLoad) loaded.set(filenameAndExtension(element).nameWithoutExt, Buffer.from(await bunClient.file(element).bytes()))
  for (const element of small) loaded.set(imageName(element), element)

  const smallNoImage = Bun.file(`${root}/gui/maps/icons/vehicle/small/noImage.png`);
  if (await smallNoImage.exists()) loaded.set('no-image', Buffer.from(await smallNoImage.bytes()));

  const atlases = await createSpriteAtlas({
    images: [...loaded.keys()],
    width: 124,
    height: 31,
    gap: 0,
    resolutions: resolutions,
  })

  for (const atlas of atlases) {
    const spriteSheet = sharp({
      create: {
        width: atlas.info.resolution.width,
        height: atlas.info.resolution.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const prepare: sharp.OverlayOptions[] = []

    for (const item of atlas.data) {
      const targetWidth = item.width ?? atlas.info.defaultItemSize.width;
      const targetHeight = item.height ?? atlas.info.defaultItemSize.height;
      let img = loaded.get(item.image)!

      const metadata = await sharp(img).metadata();
      if (metadata.width !== targetWidth || metadata.height !== targetHeight) {
        img = await sharp(img).resize(targetWidth, targetHeight).toBuffer();
      }

      img = await spriteFixer(item.image, img);

      prepare.push({
        input: img,
        left: item.x,
        top: item.y,
      })
    }

    spriteSheet.composite(prepare);

    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.webp`, await spriteSheet.webp({ alphaQuality: 70, quality: 85 }).toBuffer())
    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.png`, await spriteSheet.png().toBuffer())
    await upload(`vehicles/small/atlas/${maxResolution}/atlas_${atlas.info.index}.json`, JSON.stringify(atlas))
  }

  await upload(`vehicles/small/atlas/${maxResolution}/atlases.json`, JSON.stringify(atlases))

}

export async function load(root: string, game: 'mt' | 'wot', version: string, bucket: AwsS3Client) {

  console.log(`Loading vehicles...`);

  const upload = uploader(game, version, bucket);

  await generateSmallSprite(root, game, upload, [256, 512, 1024, 2048, 4096]);
  await generateSmallSprite(root, game, upload, [256, 512, 1024, 2048]);
  await generateSmallSprite(root, game, upload, [256, 512, 1024]);

  await loadShop(root, upload);
  await loadSmall(root, upload);
  await loadMedium(root, upload);
  await loadPreview(root, upload);

  console.log(`Vehicles preview images loaded`);
}