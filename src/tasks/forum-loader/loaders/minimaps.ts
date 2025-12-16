import { clickhouse } from "@/db";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from 'sharp'
import { uploader } from '../../../utils/assetsUploader'
import { Database } from "bun:sqlite";
import { $ } from 'bun';

await $`mkdir -p /data/forum`.quiet();
const db = new Database('/data/forum/minimaps.sqlite', { create: true, strict: true });
db.exec(`
CREATE TABLE IF NOT EXISTS minimaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT,
  gameVersion TEXT,
  lastHref TEXT,
  UNIQUE(tag, gameVersion)
);
`);

const getLastHref = db.prepare<{ lastHref: string }, { tag: string; gameVersion: string }>(`
  SELECT lastHref FROM minimaps WHERE tag = $tag AND gameVersion = $gameVersion;
`);

const updateLastHref = db.prepare<{}, { tag: string; gameVersion: string; lastHref: string }>(`
  INSERT INTO minimaps (tag, gameVersion, lastHref)
  VALUES ($tag, $gameVersion, $lastHref)
  ON CONFLICT(tag, gameVersion) DO UPDATE SET lastHref = $lastHref;
`);


async function arenasList(cookies: string) {
  const arenas: { title: string; href: string }[] = [];
  const arenasParser = new HTMLRewriter()
    .on('.ipsBox tr h4 a.topic_title', {
      element(element) {
        const href = element.getAttribute('href');
        arenas.push({ title: '', href: href! });
      },
      text(text) {
        const title = text.text;
        if (title.trim() == '') return;
        arenas[arenas.length - 1].title = title;
      }
    })

  const pageLinks: string[] = [];
  const pagesParser = new HTMLRewriter()
    .on('.topic_controls.clear .page a', {
      element(element) {
        const href = element.getAttribute('href');
        if (!href) return;
        pageLinks.push(href);
      }
    })


  console.log('Loading arenas list from forum...');
  const res = await fetch(
    'http://forum.tanki.su/index.php?/forum/580-%d0%ba%d0%b0%d1%80%d1%82%d1%8b/',
    { headers: { 'Cookie': cookies }, signal: AbortSignal.timeout(5000) }
  );
  console.log(`Fetching arenas list from ${res.url} - status: ${res.status}`);
  const text = await res.text();
  console.log(`Fetched arenas list from ${res.url} - length: ${text.length}`);

  await new Promise(r => setTimeout(r, 1000)); // to avoid rate limiting

  arenasParser.transform(text);
  pagesParser.transform(text);

  for (const pageLink of pageLinks) {
    console.log(`Loading arenas list from page ${pageLink}...`);
    const res = await fetch(pageLink, { headers: { 'Cookie': cookies } });
    console.log(`Fetching arenas list from page ${pageLink} - status: ${res.status}`);
    const text = await res.text();
    console.log(`Fetched arenas list from page ${pageLink}, length: ${text.length}`);
    await new Promise(r => setTimeout(r, 1000)); // to avoid rate limiting

    arenasParser.transform(text);
  }

  return arenas;
}

async function loadMinimapLink(cookies: string, pageHref: string) {

  let link = '';
  const parser = new HTMLRewriter()
    .on('.bbc_spoiler_content img', {
      element(element) {
        const src = element.getAttribute('data-src');
        if (src && !link) link = src;
      }
    })

  const res = await fetch(pageHref, { headers: { 'Cookie': cookies } });
  const text = await res.text();
  parser.transform(text);

  return link;
}

async function arenasTag() {
  const res = await clickhouse.query({
    query: `
      select name, argMax(tag, datetime) as tag
      from WOT.Arenas
      where region = 'RU'
      group by name
    `
  })

  const result = await res.json<{ name: string; tag: string }>();


  return new Map(result.data.map(x => [x.name, x.tag]));
}

export async function loadMinimaps(cookies: string, version: string, bucket: S3Client) {

  const upload = uploader('mt', version, bucket)

  const arenas = (await arenasList(cookies))
  const tags = await arenasTag()
  const arenasWithTags = arenas
    .map(t => ({ ...t, tag: tags.get(t.title) || null }))
    .filter(t => t.tag != null);

  const notFound = arenas.filter(t => !tags.has(t.title));
  if (notFound.length > 0) console.error('Arenas cannot be found tag:', notFound);

  const minimapLinks: { title: string; tag: string, link: string }[] = [];

  console.log(`Found ${arenasWithTags.length} arenas with tags, loading minimap links...`);
  for (const arena of arenasWithTags) {
    const link = await loadMinimapLink(cookies, arena.href);
    minimapLinks.push({ title: arena.title, tag: arena.tag!, link });
  }
  console.log(`Loaded minimap links for ${minimapLinks.length} arenas, downloading and uploading minimaps...`);

  for (const minimap of minimapLinks) {

    if (!minimap.link) {
      console.error(`No minimap link for arena '${minimap.title}'`);
      continue;
    }

    const lastRecord = getLastHref.get({ tag: minimap.tag, gameVersion: version });
    if (lastRecord && lastRecord.lastHref === minimap.link) continue;

    const res = await fetch(minimap.link, { headers: { 'Cookie': cookies } });
    if (!res.ok) {
      console.error(`Failed to fetch minimap for arena '${minimap.tag}' from ${minimap.link}: ${res.status} ${res.statusText}`);
      continue;
    }

    const fileContent = Buffer.from(await res.arrayBuffer());

    const webpBuffer = await sharp(fileContent).webp({ quality: 80 }).toBuffer()
    await upload(`arenas/minimap-hd/${minimap.tag}.png`, fileContent)
    await upload(`arenas/minimap-hd/${minimap.tag}.webp`, webpBuffer)

    updateLastHref.run({ tag: minimap.tag, gameVersion: version, lastHref: minimap.link });
    console.log(`Uploaded minimap for arena '${minimap.tag}'`);
  }


  console.log('Done loading minimaps');

}

