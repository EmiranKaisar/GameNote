import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseInfo = JSON.parse(readFileSync(resolve(appRoot, 'release-info.json'), 'utf8'));
const tag = process.argv[2];
const expectedTag = `v${releaseInfo.version}`;

if (!tag) {
  console.error(`Provide a release tag. Expected: ${expectedTag}`);
  process.exit(2);
}

if (tag !== expectedTag) {
  console.error(`Release tag "${tag}" does not match release-info.json. Expected: ${expectedTag}`);
  process.exit(2);
}

console.log(`${tag} matches Game Note V${releaseInfo.version}.`);
