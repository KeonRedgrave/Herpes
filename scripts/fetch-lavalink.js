const { mkdirSync, existsSync, createWriteStream } = require('node:fs');
const { join } = require('node:path');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');

const streamPipeline = promisify(pipeline);
const lavalinkDir = join(__dirname, '..', 'lavalink');
const jarPath = join(lavalinkDir, 'Lavalink.jar');
const releaseApi = 'https://api.github.com/repos/freyacodes/Lavalink/releases/latest';

async function download(url, dest) {
  const response = await fetch(url, { headers: { 'User-Agent': 'node-fetch' } });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  await streamPipeline(response.body, createWriteStream(dest));
}

async function main() {
  if (existsSync(jarPath)) {
    console.log('Lavalink.jar already exists, skipping download.');
    return;
  }

  mkdirSync(lavalinkDir, { recursive: true });
  console.log('Downloading Lavalink server...');

  const response = await fetch(releaseApi, { headers: { 'User-Agent': 'node-fetch' } });
  if (!response.ok) {
    throw new Error(`Lavalink metadata request failed: ${response.status} ${response.statusText}`);
  }

  const release = await response.json();
  const asset = release.assets.find(asset => asset.name.endsWith('.jar'));
  if (!asset) {
    throw new Error('Could not find a Lavalink jar asset in the release metadata.');
  }

  console.log(`Found Lavalink asset: ${asset.name}`);
  await download(asset.browser_download_url, jarPath);
  console.log('Lavalink download complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
