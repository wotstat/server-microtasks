import { Glob, $ } from "bun"

const files = [...new Glob('./gui/maps/shop/vehicles/360x270/*.png').scanSync()]

const nationMap = {
  'A': 'usa',
  'Ch': 'china',
  'Cz': 'czech',
  'F': 'france',
  'G': 'germany',
  'GB': 'uk',
  'It': 'italy',
  'J': 'japan',
  'Pl': 'poland',
  'R': 'ussr',
  'S': 'sweden',
}

const nationEntries = Object.entries(nationMap)

for (const path of files) {
  const file = Bun.file(path)
  const fileName = path.split('/').at(-1)!

  for (const [prefix, nation] of nationEntries) {
    if (fileName.startsWith(prefix)) {
      await Bun.write(`./_proc/${nation}-${fileName}`, file)
      break
    }
  }
}

console.log('Files:', files.length);

await $`
aws --endpoint-url=https://storage.yandexcloud.net/ \
  s3 cp ./_proc s3://static.wotstat.info/vehicles/shop \
  --recursive \
  --exclude "*" \
  --include "*.png" \
  --exclude "*/**" \
  --cache-control 'max-age=31622400' \
  --profile wotstat
`

console.log('Done!');
