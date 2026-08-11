// Fetches all uploads for the configured channel(s) and writes paginated JSON
// into the `data/videos/` folder — the Node port of `videos_fetch.py`.
//
// Configuration is read from environment variables only:
//   YOUTUBE_API_KEY
//   YOUTUBE_CHANNELS (comma-separated) / YOUTUBE_CHANNEL
import { YouTubeClient } from './youtube-client.mjs';

function loadSettings() {
  const envChannels =
    process.env.YOUTUBE_CHANNELS ?? process.env.YOUTUBE_CHANNEL;
  const rawList = String(envChannels ?? '').split(',');
  const channels = rawList.map((c) => c.trim()).filter(Boolean);

  return {
    apiKey: process.env.YOUTUBE_API_KEY,
    channels,
  };
}

async function main() {
  const { apiKey, channels } = loadSettings();

  if (!apiKey || channels.length === 0) {
    console.error(
      'Missing API key or channel(s). Set YOUTUBE_API_KEY and YOUTUBE_CHANNELS.'
    );
    process.exitCode = 1;
    return;
  }

  const client = new YouTubeClient(apiKey);

  for (const [order, channel] of channels.entries()) {
    const info = await client.getChannelInfo(channel);
    if (!info?.uploadsPlaylistId) {
      console.error(`No uploads playlist found for channel ${channel}.`);
      process.exitCode = 1;
      continue;
    }

    const videos = await client.getUploadedVideos(info.uploadsPlaylistId);
    if (videos.length === 0) {
      console.error(`No uploaded videos found for channel ${channel}.`);
      continue;
    }

    const outputPath = await client.storeChannelVideos(channel, videos, {
      title: info.title,
      order,
    });
    console.log(
      `Stored ${videos.length} videos for "${info.title}" (${channel}) in ${outputPath}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
