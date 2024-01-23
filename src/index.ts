import { exec } from '@cloud-cli/exec';
import { Console, lambda } from '@node-lambdas/core';
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const workingDir = process.env.WORKING_DIR;

const repoUrl = (repo: string) => {
  const [owner, ref = 'main'] = repo.split(':');
  return `https://codeload.github.com/${owner}/zip/refs/heads/${ref}`;
};

async function main() {
  try {
    const source = getSource();

    if (source) {
      const filePath = await download(source);
      await extractFile(filePath);
    }

    await npmInstall();
    await startServer();
  } catch (error) {
    Console.error(`Failed to run: ${String(error)}`);
    Console.debug(error.stack);
  }
}

function getSource() {
  const sourceRepo = process.env.REPOSITORY;
  const sourceUrl = process.env.SOURCE_URL;
  const source = !sourceUrl && sourceRepo ? repoUrl(sourceRepo) : sourceUrl;

  if (source) {
    Console.info('Using source at ' + source);
  }

  return source;
}

async function extractFile(filePath: string) {
  switch (true) {
    case filePath.endsWith('.tgz'):
      const tar = await exec('tar', ['xzf', workingDir, filePath]);

      if (!tar.ok) {
        throw new Error('Unable to extract file: ' + tar.stderr);
      }

      break;

    case filePath.endsWith('.zip'):
      const zip = await exec('unzip', ['-o', '-d', workingDir, filePath]);

      if (!zip.ok) {
        throw new Error('Unable to extract file: ' + zip.stderr);
      }

      break;

    default:
      throw new Error(`Unsupported file format at ${filePath}`);
  }
}

async function npmInstall() {
  let rootFolder: string;

  if (existsSync(join(workingDir, 'package.json'))) {
    rootFolder = workingDir;
  }

  const subFolder = (await readdir(workingDir))[0] || '';
  if (subFolder && existsSync(join(workingDir, subFolder, 'package.json'))) {
    rootFolder = join(workingDir, subFolder);
  }

  if (!rootFolder) {
    throw new Error(`Unable to find package.json at ${workingDir}`);
  }

  Console.info(`Installing dependencies at ${rootFolder}`);
  process.chdir(rootFolder);

  const npmi = await exec('npm', ['i', '--no-audit', '--no-fund'], { cwd: rootFolder });

  if (npmi.code !== 0) {
    Console.log(npmi.stdout);
    Console.error(npmi.stderr);
    throw new Error(`Failed to install dependencies`);
  }

  Console.log(npmi.stdout);
}

async function download(url: string) {
  let extension = '';

  if (url.endsWith('.tgz') || url.endsWith('.tar.gz')) {
    extension = '.tgz';
  }

  if (url.endsWith('.zip') || url.includes('zip/refs')) {
    extension = '.zip';
  }

  if (!extension) {
    throw new Error(`Unsupported format at ${url}`);
  }

  const filePath = '/tmp/fn' + extension;
  if (existsSync(filePath) && process.env.USE_CACHED) {
    return filePath;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${await response.text()}`);
  }

  const file = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, file);

  return filePath;
}

async function startServer() {
  const fnPath = ['index.mjs', 'index.js'].map((p) => join(process.cwd(), p)).find((p) => existsSync(p));

  if (!fnPath) {
    throw new Error('Cannot run lambda: entrypoint not found.');
  }

  Console.log(`Loading ${fnPath}`);
  let fn;

  try {
    fn = await import(fnPath);
  } catch (failed) {
    Console.log(String(failed));
    throw failed;
  }

  const configurations = fn['default'] || fn;
  Console.debug(JSON.stringify(configurations));

  const { server } = lambda(configurations);

  Console.info(`[${new Date().toISOString().slice(0, 16)}] started from ${fnPath}`);
  server.on('close', () => process.exit(1));
}

main();
