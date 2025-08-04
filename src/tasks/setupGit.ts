
import { $ } from 'bun'

export async function setupGit(root: string, url: string) {

  await $`mkdir -p ${root}`
  $.cwd(root)

  const isGitInit = (await $`[ -e .git ] && echo "true" || echo "false"`.text()).trim() === 'true'

  if (!isGitInit) {
    console.log('Git is not init. Cloning...');
    await $`git clone --depth 1 --no-single-branch ${url} ${root}`.quiet()
    console.log('Git clone done');
  }

  const isGitLocked = (await $`[ -e ./.git/index.lock ] && echo "true" || echo "false"`.text()).trim() === 'true'
  if (isGitLocked) {
    console.log('Git is locked. Removing lock...');
    await $`rm -f ./.git/index.lock`
    console.log('Git lock removed');
  }

  await $`git reset --hard`.quiet()
  await $`git clean -fd`.quiet()

  const res = await $`git rev-parse --is-inside-work-tree`.text()
  if (res.trim() == 'true') {
    await $`git fetch`.quiet()
    console.log('Git fetch done');
  }

  console.log(`Repo ${url} setup completely`);
}

export async function hasBranchChanges(branch: string) {
  await $`git checkout ${branch}`
  await $`git fetch origin ${branch}`.quiet()

  return (await $`git rev-list HEAD...origin/${branch} --count`.text()).trim() !== '0';
}