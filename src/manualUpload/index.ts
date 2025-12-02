
import { uploader } from "../utils/assetsUploader";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client();

const upload = uploader('mt', '1.28.0.0', s3Client)
const name = 'ny_2026_surprise'

const fileContent = await Bun.file(`/app/src/manualUpload/${name}.png`).bytes()

const largeContent = await sharp(fileContent).resize(600, 450).toBuffer()
const largeWebpBuffer = await sharp(largeContent).webp({ quality: 75, alphaQuality: 20, smartSubsample: true }).toBuffer()

// await upload(`lootboxes/large/${name}.png`, fileContent)
// await upload(`lootboxes/large/${name}.webp`, largeWebpBuffer)
