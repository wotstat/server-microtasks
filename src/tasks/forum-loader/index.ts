import { loadMinimaps } from "./loaders/minimaps";
import { ListObjectsCommand, S3Client } from "@aws-sdk/client-s3";


const s3Client = new S3Client();


async function calculateCookie() {

  const hasher = new Bun.CryptoHasher('md5');

  const res = await fetch("http://forum.tanki.su/")
  const text = await res.text()

  const tcp = text.match(/tpc = "(\w*)"/)?.[1];
  const chk = text.match(/chk = "(\w*)"/)?.[1];
  const pss = text.match(/'(pss_\w*)='/g)?.map(x => x.replace(/'/g, '').replace('=', ''));

  if (!tcp || !chk || !pss || pss.length < 2) return null

  let nonce = ''
  for (let i = 0; i < 1e9; i++) {
    const hash = hasher.update(`${tcp}::${i}`).digest('hex');
    if (hash.startsWith(chk)) {
      nonce = `${i}`;
      break;
    }
  }

  return {
    [pss[0]]: tcp,
    [pss[1]]: nonce
  }

}

async function getLatestAssetsVersion() {
  const response = await s3Client.send(new ListObjectsCommand({
    Bucket: Bun.env.AWS_BUCKET,
    Delimiter: "/",
    Prefix: 'mt/'
  }));

  const latest = response.CommonPrefixes?.map(x => x.Prefix)
    .map(x => x?.split('/')[1] ?? '')
    .filter(x => x && x !== 'latest')
    .sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aNum = aParts[i] || 0;
        const bNum = bParts[i] || 0;
        if (aNum !== bNum) {
          return bNum - aNum;
        }
      }
      return 0;
    })[0];


  return latest
}

export async function load() {
  console.log(`Loading Forum data...`);
  const cookie = await calculateCookie();

  if (!cookie) return console.log('Failed to calculate forum cookie');
  const cookies = Object.entries(cookie).map(([k, v]) => `${k}=${v}`).join('; ');
  const version = await getLatestAssetsVersion()

  if (!version) return console.log('Failed to get latest assets version');

  await loadMinimaps(cookies, version, s3Client);
}