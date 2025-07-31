
import { $ } from 'bun'
import { parseGameVersion } from './utils';

import { load as loadArenas } from "./loaders/arenas";
import { load as loadLootbox } from "./loaders/lootboxes";
import { load as loadArtefacts } from "./loaders/artefacts";
import { load as loadCustomizations } from "./loaders/customizations";
import { load as loadVehicles } from "./loaders/vehicles";
import { load as loadVersion } from "./loaders/version";
import { hasBranchChanges, setupGit } from '../setupGit';

// const BRANCHES = ['PT_RU']
const BRANCHES = ['EU', 'NA', 'RU', 'PT_RU', 'CN', 'ASIA']
const root = '/data/wot-src'

export async function load() {

  console.log(`Loading WOT src...`);

  await setupGit(root, 'https://github.com/IzeBerg/wot-src.git')
  $.cwd(root)

  for (const branch of BRANCHES) {
    console.log(`Checkout to '${branch}'`);
    const hasChanges = await hasBranchChanges(branch)

    if (!hasChanges) {
      console.log(`Branch '${branch}' hasnt changes, skip`)
      continue
    }

    await $`git pull --ff-only`

    const version = await parseGameVersion(root)

    console.log(`Branch: ${branch}, Version: ${JSON.stringify(version)}`);
    try { await loadVehicles(root, branch, version) } catch (error) { console.error(error) }
    try { await loadArenas(root, branch, version) } catch (error) { console.error(error) }
    try { await loadLootbox(root, branch, version) } catch (error) { console.error(error) }
    try { await loadArtefacts(root, branch, version) } catch (error) { console.error(error) }
    try { await loadCustomizations(root, branch, version) } catch (error) { console.error(error) }
    try { await loadVersion(root, branch, version) } catch (error) { console.error(error) }
  }

  console.log('All src branches loaded');

}