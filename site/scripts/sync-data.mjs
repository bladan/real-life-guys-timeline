// Copies the paginated video JSON files from the `data/videos/` folder
// into `public/videos/` so they can be lazy-loaded by the browser.
import { cp, rm, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
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

// Build a statistics.json with the 50 most-viewed videos across all channels.
const entries = await readdir(source, { withFileTypes: true });
const videos = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  const channelDir = resolve(source, entry.name);
  const index = JSON.parse(
    await readFile(resolve(channelDir, 'index.json'), 'utf-8')
  );
  const channelTitle = index.channel_title ?? entry.name;
  for (let page = 1; page <= index.page_count; page += 1) {
    const data = JSON.parse(
      await readFile(resolve(channelDir, `page-${page}.json`), 'utf-8')
    );
    for (const video of data.videos ?? []) {
      videos.push({
        video_id: video.video_id,
        title: video.title,
        channel: channelTitle,
        published_at: video.published_at,
        view_count: video.view_count ?? 0,
        like_count: video.like_count ?? 0,
        comment_count: video.comment_count ?? 0,
        thumbnail: video.thumbnail,
        url: video.url,
      });
    }
  }
}

const topVideos = videos
  .sort((a, b) => b.view_count - a.view_count)
  .slice(0, 50);

const statisticsPath = resolve(dest, 'statistics.json');
await writeFile(
  statisticsPath,
  JSON.stringify(
    { generated_at: new Date().toISOString(), top_videos: topVideos },
    null,
    2
  )
);

console.log(`Wrote statistics -> ${statisticsPath}`);
