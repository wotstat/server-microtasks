
import { $ } from 'bun'
import { parseGameVersion } from './utils';

import { load as loadArenas } from "./loaders/arenas";
import { load as loadLootbox } from "./loaders/lootboxes";
import { load as loadArtefacts } from "./loaders/artefacts";
import { load as loadCustomizations } from "./loaders/customizations";
import { load as loadVehicles } from "./loaders/vehicles";

// const BRANCHES = ['RU']
const BRANCHES = ['EU', 'NA', 'RU', 'PT_RU', 'CN', 'ASIA']
const root = '/data/wot-src'

export async function setupGit() {

  await $`mkdir -p ${root}`
  $.cwd(root)

  const files = await $`ls -la . | grep .git`.text()
  const isGitInit = files.includes('.git')

  if (!isGitInit) {
    console.log('Git is not init. Cloning...');
    await $`git clone https://github.com/IzeBerg/wot-src.git ${root}`
    console.log('Git clone done');
  }

  const isGitLocked = (await $`ls -la ./.git | grep index.lock`.text()).includes('index.lock')
  if (isGitLocked) {
    console.log('Git is locked. Removing lock...');
    await $`rm -f ./.git/index.lock`
    console.log('Git lock removed');
  }

  await $`git reset --hard`.quiet()
  await $`git clean -fd`.quiet()

  const res = await $`git rev-parse --is-inside-work-tree`.text()
  if (res.trim() == 'true') {
    await $`git fetch && git pull --ff-only`.quiet()
    console.log('Git fetch and pull done');
  }

  console.log('Repo setup complete');
}

export async function load() {
  await setupGit()
  $.cwd(root)

  for (const branch of BRANCHES) {
    console.log(`\nCheckout to ${branch}`);

    await $`git checkout ${branch}`
    await $`git pull --ff-only`

    const version = await parseGameVersion(root)

    console.log(`Branch: ${branch}, Version: ${JSON.stringify(version)}`);

    await loadVehicles(root, branch, version)
    await loadArenas(root, branch, version)
    await loadLootbox(root, branch, version)
    await loadArtefacts(root, branch, version)
    await loadCustomizations(root, branch, version)
  }

  console.log('All branches loaded');

}