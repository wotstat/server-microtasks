
import { $ } from 'bun'
import { parseGameVersion } from './utils';

import { load as loadArenas } from "./loaders/arenas";
import { load as loadLootbox } from "./loaders/lootboxes";
import { load as loadArtefacts } from "./loaders/artefacts";
import { load as loadCustomizations } from "./loaders/customizations";
import { load as loadVehicles } from "./loaders/vehicles";
import { load as loadVersion } from "./loaders/version";
import { load as loadOptionalDevices } from "./loaders/optionalDevices";
import { load as loadEquipments } from "./loaders/equipments";
import { hasBranchChanges, setupGit } from '../setupGit';
import { clickhouse } from '@/db';

// const BRANCHES = ['RU']
const BRANCHES = ['EU', 'NA', 'RU', 'PT_RU', 'CN', 'ASIA', 'CT']
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

    await $`git pull --ff-only`.quiet()

    const version = await parseGameVersion(root)

    console.log(`Branch: ${branch}, Version: ${JSON.stringify(version)}`);
    try { await loadVehicles(root, branch, version) } catch (error) { console.error(error) }
    try { await loadArenas(root, branch, version) } catch (error) { console.error(error) }
    try { await loadLootbox(root, branch, version) } catch (error) { console.error(error) }
    try { await loadArtefacts(root, branch, version) } catch (error) { console.error(error) }
    try { await loadCustomizations(root, branch, version) } catch (error) { console.error(error) }
    try { await loadVersion(root, branch, version) } catch (error) { console.error(error) }
    try { await loadOptionalDevices(root, branch, version) } catch (error) { console.error(error) }
    try { await loadEquipments(root, branch, version) } catch (error) { console.error(error) }
  }

  for (const table of [
    'WOT.vehicles_latest_mv',
    'WOT.vehicles_localization_mv',
    'WOT.arenas_localization_mv',
    'WOT.arenas_latest_mv',
    'WOT.lootboxes_localization_mv',
    'WOT.artefacts_localization_mv',
    'WOT.game_versions_latest_mv',
    'WOT.optional_devices_latest_mv',
    'WOT.equipments_latest_mv'
  ]) {
    await clickhouse.exec({ query: `system refresh view ${table}` })
  }

  console.log('All src branches loaded');

}