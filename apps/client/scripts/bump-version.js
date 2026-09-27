import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const versionFilePath = path.resolve(__dirname, '../version.json');

export function bumpVersion() {
  let data = {
    major: 1,
    minor: 0,
    build: 1,
    version: 'v.1.0.01',
    buildTime: new Date().toISOString(),
  };

  if (fs.existsSync(versionFilePath)) {
    try {
      const raw = fs.readFileSync(versionFilePath, 'utf-8');
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed };
    } catch (e) {
      console.warn('[version] Could not read existing version.json, creating new one.', e);
    }
  }

  // Increment build counter
  data.build = typeof data.build === 'number' && Number.isFinite(data.build) ? data.build + 1 : 1;
  const buildStr = data.build < 100 ? String(data.build).padStart(2, '0') : String(data.build);
  data.version = `v.${data.major}.${data.minor}.${buildStr}`;
  data.buildTime = new Date().toISOString();

  fs.writeFileSync(versionFilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  process.env.VITE_VERSION_BUMPED = 'true';
  console.log(`[version] Bumped version to ${data.version} (build #${data.build}) at ${data.buildTime}`);
  return data;
}

// If executed directly from command line (e.g. node scripts/bump-version.js)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  bumpVersion();
}
