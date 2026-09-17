import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appRoot, '..');
const buildRoot = join(repositoryRoot, 'build');
const cargoTarget = join(buildRoot, 'cargo');
const tauriConfig = JSON.parse(readFileSync(join(appRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const companyInfo = JSON.parse(readFileSync(join(appRoot, 'company-info.json'), 'utf8'));
const releaseInfo = JSON.parse(readFileSync(join(appRoot, 'release-info.json'), 'utf8'));
const productName = tauriConfig.productName;
const normalizedProductName = productName.toLowerCase().replace(/[^a-z0-9]/g, '');
const requested = process.argv[2];
const host = process.platform;
const npm = host === 'win32' ? 'npm.cmd' : 'npm';

const requiredCompanyFields = ['companyName', 'legalName', 'supportEmail', 'license'];
for (const field of requiredCompanyFields) {
  if (typeof companyInfo[field] !== 'string' || !companyInfo[field].trim()) {
    console.error(`company-info.json must contain a valid "${field}" string.`);
    process.exit(2);
  }
}
if (!/^\S+@\S+\.\S+$/.test(companyInfo.supportEmail)) {
  console.error('company-info.json contains an invalid "supportEmail" value.');
  process.exit(2);
}

const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
if (typeof releaseInfo.version !== 'string' || !semanticVersionPattern.test(releaseInfo.version)) {
  console.error('release-info.json must contain a semantic "version" such as "1.0.0".');
  process.exit(2);
}
if (typeof releaseInfo.updateSummary !== 'string' || !releaseInfo.updateSummary.trim() || releaseInfo.updateSummary.length > 240) {
  console.error('release-info.json must contain an "updateSummary" between 1 and 240 characters.');
  process.exit(2);
}

const buildConfig = JSON.stringify({
  version: releaseInfo.version,
  bundle: {
    publisher: companyInfo.legalName,
    copyright: `Copyright © 2026 ${companyInfo.legalName}`,
    license: companyInfo.license,
    longDescription: `${tauriConfig.bundle.shortDescription}. Developed by ${companyInfo.companyName}.`,
    resources: {
      '../company-info.json': 'company-info.json',
      '../release-info.json': 'release-info.json',
      '../../LICENSE': 'LICENSE',
      '../../PRIVACY.md': 'PRIVACY.md',
      '../../THIRD_PARTY_NOTICES.md': 'THIRD_PARTY_NOTICES.md',
    },
  },
});

const definitions = {
  macos: { hosts: ['darwin'], folder: 'macos', args: ['build', '--bundles', 'app'] },
  'macos-dmg': { hosts: ['darwin'], folder: 'macos-dmg', args: ['build', '--bundles', 'dmg'] },
  'macos-universal': { hosts: ['darwin'], folder: 'macos-universal', args: ['build', '--target', 'universal-apple-darwin', '--bundles', 'app'] },
  windows: { hosts: ['win32'], folder: 'windows', args: ['build', '--bundles', 'nsis,msi'] },
  android: { hosts: ['darwin', 'linux', 'win32'], folder: 'android', args: ['android', 'build'] },
  ios: { hosts: ['darwin'], folder: 'ios', args: ['ios', 'build'] },
};

const definition = definitions[requested];
if (!definition) {
  console.error(`Unknown platform "${requested ?? ''}". Use: ${Object.keys(definitions).join(', ')}`);
  process.exit(2);
}
if (!definition.hosts.includes(host)) {
  console.error(`${requested} packages must be built on ${definition.hosts.join(' or ')}. Current host: ${host}.`);
  process.exit(2);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env: { ...process.env, CARGO_TARGET_DIR: cargoTarget },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (requested === 'macos-universal') {
  const rustupPath = join(process.env.HOME ?? '', '.cargo', 'bin', 'rustup');
  const rustup = existsSync(rustupPath)
    ? rustupPath
    : 'rustup';
  run(rustup, ['target', 'add', 'aarch64-apple-darwin', 'x86_64-apple-darwin']);
}

mkdirSync(buildRoot, { recursive: true });
run(npm, ['exec', '--', 'tauri', ...definition.args, '--config', buildConfig]);

const output = join(buildRoot, definition.folder);
const outputReadme = join(output, 'README.md');
const preservedReadme = existsSync(outputReadme) ? readFileSync(outputReadme, 'utf8') : null;
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
if (preservedReadme !== null) writeFileSync(outputReadme, preservedReadme);

const wantedExtensions = new Set(['.dmg', '.msi', '.exe', '.apk', '.aab', '.ipa']);
const copied = [];

function copyArtifacts(folder) {
  if (!existsSync(folder)) return;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const source = join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app')) {
        if (entry.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== `${normalizedProductName}app`) continue;
        const destination = join(output, entry.name);
        cpSync(source, destination, { recursive: true });
        copied.push(destination);
      } else {
        copyArtifacts(source);
      }
    } else if (wantedExtensions.has(extname(entry.name).toLowerCase())) {
      if (!entry.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(normalizedProductName)) continue;
      const destination = join(output, basename(source));
      cpSync(source, destination);
      copied.push(destination);
    }
  }
}

if (requested.startsWith('macos') || requested === 'windows') {
  copyArtifacts(cargoTarget);
} else {
  copyArtifacts(join(appRoot, 'src-tauri', 'gen', requested));
}

if (!copied.length) {
  console.error(`The build succeeded, but no package was found to collect in ${output}.`);
  process.exit(1);
}

console.log(`\nGame Note ${requested} artifacts:`);
for (const artifact of copied) console.log(`- ${artifact}`);
console.log(`Company metadata: ${companyInfo.legalName}`);
console.log(`Release: V${releaseInfo.version} — ${releaseInfo.updateSummary}`);
