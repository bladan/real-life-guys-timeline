// Copies the paginated video JSON files from the `data/videos/` folder
// into `public/videos/` so they can be lazy-loaded by the browser.
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = resolve(__dirname, '../data/videos');
const dest = resolve(__dirname, '../public/videos');

if (!existsSync(source)) {
  console.error(`Source data folder not found: ${source}`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(source, dest, { recursive: true });

console.log(`Synced video data -> ${dest}`);
