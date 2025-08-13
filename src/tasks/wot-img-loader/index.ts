
import { $ } from 'bun'
import { S3Client } from "@aws-sdk/client-s3";

import { load as loadVehicles } from "./loaders/vehicles";
import { load as loadLootboxes } from "./loaders/lootboxes";
import { load as loadShells } from "./loaders/shells";
import { load as loadMaps } from "./loaders/maps";
import { hasBranchChanges, setupGit } from '../setupGit';

// const BRANCHES = ['Lesta']
const BRANCHES = ['WG', 'Lesta']
const root = '/data/wot-assets'

const branchToGame: Record<string, 'mt' | 'wot'> = {
  'WG': 'wot',
  'Lesta': 'mt'
}


const s3Client = new S3Client();


export async function load() {
  console.log(`Loading WOT assets...`);

  await setupGit(root, 'https://github.com/Kurzdor/wot.assets.git')
  $.cwd(root)

  for (const branch of BRANCHES) {
    console.log(`Checkout to '${branch}'`);
    const hasChanges = await hasBranchChanges(branch)

    if (!hasChanges) {
      console.log(`Branch '${branch}' hasnt changes, skip`)
      continue
    }

    await $`git pull --ff-only`

    const version = (await Bun.file(`${root}/.metadata_version`).text()).split(' ')[0].trim();
    console.log(`Branch ${branch} updated to ${version}`);


    const game = branchToGame[branch];
    try { await loadMaps(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadShells(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadLootboxes(root, game, version, s3Client) } catch (error) { console.error(error) }
    try { await loadVehicles(root, game, version, s3Client) } catch (error) { console.error(error) }
  }

  console.log('All assets branches loaded');

}