import { exec } from '@cloud-cli/exec';
import { Console, lambda } from '@node-lambdas/core';
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let errorBudget = Number(process.env.MAX_RESTART || 5);
const workingDir = process.env.WORKING_DIR || '/home/fn';

const repoUrl = (repo: string) => {
  const [owner, ref = 'main'] = repo.split(':');
  return `https://codeload.github.com/${owner}/zip/refs/heads/${ref}`;
};

async function main() {
  try {
    const source = getSource();
    const filePath = await download(source);
    await extractFile(filePath);
    await npmInstall();
    await startServer();
  } catch (error) {
    Console.error(`Failed to run`);
    Console.error(String(error));
    Console.debug(error.stack);
  }
}

function getSource() {
  const sourceRepo = process.env.REPOSITORY;
  const sourceUrl = process.env.SOURCE_URL;
  const source = !sourceUrl && sourceRepo ? repoUrl(sourceRepo) : sourceUrl;

  Console.info('Using source at ' + source);

  if (!source) {
    throw new Error('Missing source to run. Set REPOSITORY or SOURCE_URL');
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
  if (!npmi.ok) {
    Console.error(npmi.stderr);
    throw new Error(`Failed to install dependencies`);
  }

  Console.log(npmi.stdout);
}

async function startServer() {
  const fn = await import(join(process.cwd(), 'index.js'));
  const configurations = fn['default'] || fn;
  const { server } = lambda(configurations);

  Console.info(`[${new Date().toISOString().slice(0, 16)}] started`);
  server.on('close', () => process.exit(1));
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

main();
