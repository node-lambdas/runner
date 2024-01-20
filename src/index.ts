import { exec } from '@cloud-cli/exec';
import { Console, lambda } from '@node-lambdas/core';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

let errorBudget = Number(process.env.MAX_RESTART || 5);
const filePath = '/tmp/fn.zip';
const workingDir = process.env.WORKING_DIR || '/home/app';

const repoUrl = (repo: string) => {
  const [owner, ref = 'main'] = repo.split(':');
  return `https://codeload.github.com/${owner}/zip/refs/heads/${ref}`;
};

async function main() {
  const sourceRepo = process.env.REPOSITORY;
  const sourceUrl = process.env.SOURCE_URL;
  const source = !sourceUrl && sourceRepo ? repoUrl(sourceRepo) : sourceUrl;

  Console.info('Using source at ' + source);

  if (!source) {
    throw new Error('Missing source to run');
  }

  try {
    await download(source);
    await extractFile();
    await npmInstall();
    await startServer();
  } catch (error) {
    Console.error(`Failed to run from source: ${source}`);
    Console.error(String(error));
    Console.debug(error);
  }
}

async function extractFile() {
  switch (true) {
    case filePath.endsWith('.tgz'):
      const tar = await exec('tar', ['xzf', workingDir, filePath]);
      return tar.ok;

    case filePath.endsWith('.zip'):
      const zip = await exec('unzip', ['-o', '-d', workingDir, filePath]);
      return zip.ok;

    default:
      throw new Error(`Unsupported file format at ${filePath}`);
  }
}

async function npmInstall() {
  let rootFolder: string;

  if (existsSync(join(workingDir, 'package.json'))) {
    rootFolder = workingDir;
  }

  const subFolder = (await readdir(workingDir))[0];
  if (existsSync(join(workingDir, subFolder, 'package.json'))) {
    rootFolder = join(workingDir, subFolder);
  }

  Console.info('Installing dependencies at ' + rootFolder.replace(process.cwd(), ''));
  process.chdir(rootFolder);

  const npmi = await exec('npm', ['i', '--no-audit', '--no-fund']);
  if (!npmi.ok) {
    Console.error(npmi.stderr);
    throw new Error(`Failed to install dependencies`);
  }

  Console.log(npmi.stdout);
}

async function startServer() {
  Console.info(`[${new Date().toISOString().slice(0, 16)}] starting`);

  const fn = await import(join(process.cwd(), './index.js'));
  const configurations = fn['default'] || fn;
  const { server } = lambda(configurations);

  server.on('close', () => {
    Console.error('Server failed, restarting');
    if (errorBudget--) {
      return startServer();
    }

    Console.error('Too many failures');
  });
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

  const filePath = join('/tmp', createHash('sha256').update(url).digest('hex') + extension);

  if (existsSync(filePath)) {
    return filePath;
  }

  try {
    const response = await fetch(url);
    const file = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, file);

    return filePath;
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${String(error)}`);
  }
}

main();
