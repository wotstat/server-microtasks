
import { $ } from 'bun'
import { S3Client } from '@aws-sdk/client-s3'

import { load as loadVehicles } from './loaders/vehicles'
import { load as loadLootboxes } from './loaders/lootboxes'
import { load as loadShells } from './loaders/shells'
import { load as loadMaps } from './loaders/maps'
import { load as loadOptionalDevices } from './loaders/optionalDevices'
import { load as loadSkills } from './loaders/skills'
import { contextPrepare as comp7ContextPrepare, load as loadComp7 } from './loaders/comp7'
import { hasBranchChanges, setupGit } from '../setupGit'
import { GameVersion } from '../wot-src-loader/utils'
import { Region } from './utils'


// const BRANCHES = ['WG']
// const BRANCHES = ['Lesta']
const BRANCHES = ['WG', 'Lesta']
const root = '/data/wot-assets'

const branchToGame: Record<string, 'mt' | 'wot'> = {
  'WG': 'wot',
  'Lesta': 'mt'
}


const ctx = {} as Record<string, Record<Region, any>>
function updateCtx(region: Region, key: string, data: any) {
  if (!ctx[key]) ctx[key] = {} as Record<Region, any>
  ctx[key][region] = data
}

export async function contextPrepare(root: string, region: Region, version: GameVersion) {
  updateCtx(region, 'comp7', await comp7ContextPrepare(root, region, version))
}

const s3Client = new S3Client()
export async function load() {
  console.log('Loading WOT assets...')

  await setupGit(root, 'https://github.com/Kurzdor/wot.assets.git')
  $.cwd(root)

  for (const branch of BRANCHES) {
    console.log(`Checkout to '${branch}'`)
    const hasChanges = await hasBranchChanges(branch)

    if (hasChanges) await $`git pull --ff-only`.quiet()

    const version = (await Bun.file(`${root}/.metadata_version`).text()).split(' ')[0].trim()
    const game = branchToGame[branch]
    try { await loadComp7(root, game, version, s3Client, hasChanges, ctx['comp7']) } catch (error) { console.error(error) }

    if (!hasChanges) {
      console.log(`Branch '${branch}' hasnt changes, skip`)
      continue
    }

    console.log(`Branch ${branch} updated to ${version}`)

    try { await loadMaps(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadShells(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadLootboxes(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadVehicles(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadOptionalDevices(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadSkills(root, game, version, s3Client) } catch (error) { console.error(error) }
  }

  console.log('All assets branches loaded')

}

