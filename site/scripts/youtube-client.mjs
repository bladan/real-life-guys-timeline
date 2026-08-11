// Retrieves channel upload data from the YouTube Data API and stores it as
// paginated JSON — the Node port of the former Python `youtube_client.py`.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export class YouTubeClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async #get(endpoint, params) {
    const query = new URLSearchParams({ ...params, key: this.apiKey });
    const res = await fetch(`${BASE_URL}/${endpoint}?${query}`);
    if (!res.ok) {
      throw new Error(`YouTube API ${endpoint} failed: HTTP ${res.status}`);
    }
    return res.json();
  }

  async getChannelInfo(channelId) {
    const data = await this.#get('channels', {
      part: 'snippet,contentDetails',
      id: channelId,
    });
    const item = data.items?.[0];
    if (!item) return null;
    return {
      title: item.snippet?.title ?? channelId,
      uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
    };
  }

  async getUploadedVideos(uploadsPlaylistId) {
    if (!uploadsPlaylistId) return [];

    const videos = [];
    let pageToken;

    do {
      const data = await this.#get('playlistItems', {
        part: 'snippet,contentDetails,status',
        playlistId: uploadsPlaylistId,
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      });
      videos.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    videos.sort((a, b) => uploadDate(a).localeCompare(uploadDate(b)));
    return videos;
  }

  async storeChannelVideos(
    channelId,
    videos,
    { title, order = 0, pageSize = 50, outputDir } = {}
  ) {
    const baseDir = resolve(
      outputDir ?? resolve(import.meta.dirname, '../data/videos'),
      channelId
    );
    await rm(baseDir, { recursive: true, force: true });
    await mkdir(baseDir, { recursive: true });

    const compact = videos.map(compactVideo);
    const pageCount = Math.ceil(compact.length / pageSize);

    for (let page = 1; page <= pageCount; page += 1) {
      const start = (page - 1) * pageSize;
      const chunk = compact.slice(start, start + pageSize);
      await writeFile(
        resolve(baseDir, `page-${page}.json`),
        JSON.stringify(
          {
            channel_id: channelId,
            page,
            page_count: pageCount,
            page_size: pageSize,
            videos: chunk,
          },
          null,
          2
        )
      );
    }

    await writeFile(
      resolve(baseDir, 'index.json'),
      JSON.stringify(
        {
          channel_id: channelId,
          channel_title: title ?? channelId,
          order,
          video_count: compact.length,
          page_count: pageCount,
          page_size: pageSize,
        },
        null,
        2
      )
    );

    return baseDir;
  }
}

// Actual upload date; fall back to playlist add date.
function uploadDate(item) {
  return (
    item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? ''
  );
}

// Reduce a raw playlistItem to the fields a thumbnail gallery needs.
function compactVideo(item) {
  const snippet = item.snippet ?? {};
  const contentDetails = item.contentDetails ?? {};
  const videoId = contentDetails.videoId ?? snippet.resourceId?.videoId ?? '';

  const thumbnails = snippet.thumbnails ?? {};
  const bestThumbnail =
    thumbnails.maxres ??
    thumbnails.standard ??
    thumbnails.high ??
    thumbnails.medium ??
    thumbnails.default ??
    {};

  return {
    video_id: videoId,
    title: snippet.title,
    published_at: contentDetails.videoPublishedAt ?? snippet.publishedAt,
    thumbnail:
      bestThumbnail.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
