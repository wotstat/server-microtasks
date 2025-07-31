import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const defaultConfig = {
  Bucket: 'static.wotstat.info',
  CacheControl: 'max-age=86400', // 1 day
  StorageClass: 'STANDARD_IA'
} as const

function contentTypeGenerate(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();

  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

export function uploader(game: 'mt' | 'wot', version: string, bucket: S3Client) {
  return async (path: string, content: PutObjectCommand['input']['Body']) => {

    const contentType = contentTypeGenerate(path);

    await bucket.send(new PutObjectCommand({
      ...defaultConfig,
      ContentType: contentType,
      Key: `${game}/latest/${path}`,
      Body: content,
    }))

    await bucket.send(new PutObjectCommand({
      ...defaultConfig,
      ContentType: contentType,
      Key: `${game}/${version}/${path}`,
      Body: content,
      CacheControl: 'max-age=31622400' // 1 year
    }))
  }
}

export function filename(path: string) {
  return path.split('/').at(-1) ?? '';
}

export function filenameAndExtension(path: string) {
  const name = filename(path);
  const ext = path.split('.').pop()?.toLowerCase();
  const nameWithoutExt = name.split('.').slice(0, -1).join('.');
  return { name, ext, nameWithoutExt };
}