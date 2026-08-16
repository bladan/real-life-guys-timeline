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

  // Fetch every item of a playlist, following pagination.
  async #fetchPlaylistItems(playlistId) {
    if (!playlistId) return [];

    const videos = [];
    let pageToken;

    do {
      const data = await this.#get('playlistItems', {
        part: 'snippet,contentDetails,status',
        playlistId,
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      });
      videos.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return videos;
  }

  async getUploadedVideos(uploadsPlaylistId) {
    const videos = await this.#fetchPlaylistItems(uploadsPlaylistId);
    videos.sort((a, b) => uploadDate(a).localeCompare(uploadDate(b)));
    return videos;
  }

  // List all public playlists created by a channel.
  async getChannelPlaylists(channelId) {
    const playlists = [];
    let pageToken;

    do {
      const data = await this.#get('playlists', {
        part: 'snippet,contentDetails',
        channelId,
        maxResults: '50',
        ...(pageToken ? { pageToken } : {}),
      });
      playlists.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return playlists;
  }

  // Fetch view/like/comment counts for the given video IDs. The Data API's
  // `videos.list` accepts up to 50 IDs per request, so we batch accordingly.
  async getVideoStatistics(videoIds) {
    const stats = new Map();
    const ids = videoIds.filter(Boolean);

    for (let start = 0; start < ids.length; start += 50) {
      const batch = ids.slice(start, start + 50);
      const data = await this.#get('videos', {
        part: 'statistics',
        id: batch.join(','),
        maxResults: '50',
      });
      for (const item of data.items ?? []) {
        const s = item.statistics ?? {};
        stats.set(item.id, {
          view_count: toCount(s.viewCount),
          like_count: toCount(s.likeCount),
          comment_count: toCount(s.commentCount),
        });
      }
    }

    return stats;
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

    const stats = await this.getVideoStatistics(
      compact.map((video) => video.video_id)
    );
    for (const video of compact) {
      const s = stats.get(video.video_id);
      video.view_count = s?.view_count ?? null;
      video.like_count = s?.like_count ?? null;
      video.comment_count = s?.comment_count ?? null;
    }

    const totals = compact.reduce(
      (acc, video) => {
        acc.view_count += video.view_count ?? 0;
        acc.like_count += video.like_count ?? 0;
        acc.comment_count += video.comment_count ?? 0;
        return acc;
      },
      { view_count: 0, like_count: 0, comment_count: 0 }
    );
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
          total_view_count: totals.view_count,
          total_like_count: totals.like_count,
          total_comment_count: totals.comment_count,
          fetched_at: new Date().toISOString(),
        },
        null,
        2
      )
    );

    return baseDir;
  }

  // Fetch every playlist of a channel and write one JSON file per playlist
  // (with full compact video data + statistics) plus an index of all series.
  async storeChannelPlaylists(
    channelId,
    playlists,
    { title, minVideos = 1, outputDir } = {}
  ) {
    const baseDir = resolve(
      outputDir ?? resolve(import.meta.dirname, '../data/videos'),
      channelId,
      'playlists'
    );
    await rm(baseDir, { recursive: true, force: true });
    await mkdir(baseDir, { recursive: true });

    const summaries = [];

    for (const [order, playlist] of playlists.entries()) {
      const playlistId = playlist.id;
      const items = await this.#fetchPlaylistItems(playlistId);
      const compact = items.map(compactVideo).filter((v) => v.video_id);
      if (compact.length < minVideos) continue;

      const stats = await this.getVideoStatistics(
        compact.map((v) => v.video_id)
      );
      for (const video of compact) {
        const s = stats.get(video.video_id);
        video.view_count = s?.view_count ?? null;
        video.like_count = s?.like_count ?? null;
        video.comment_count = s?.comment_count ?? null;
      }

      const snippet = playlist.snippet ?? {};
      const thumbnails = snippet.thumbnails ?? {};
      const bestThumbnail =
        thumbnails.maxres ??
        thumbnails.standard ??
        thumbnails.high ??
        thumbnails.medium ??
        thumbnails.default ??
        {};
      const thumbnail = bestThumbnail.url ?? compact[0]?.thumbnail ?? null;

      await writeFile(
        resolve(baseDir, `${playlistId}.json`),
        JSON.stringify(
          {
            playlist_id: playlistId,
            channel_id: channelId,
            channel_title: title ?? channelId,
            title: snippet.title ?? playlistId,
            description: snippet.description ?? '',
            video_count: compact.length,
            thumbnail,
            videos: compact,
          },
          null,
          2
        )
      );

      summaries.push({
        playlist_id: playlistId,
        title: snippet.title ?? playlistId,
        description: snippet.description ?? '',
        video_count: compact.length,
        thumbnail,
        order,
      });
    }

    summaries.sort((a, b) => a.title.localeCompare(b.title, 'de'));

    await writeFile(
      resolve(baseDir, 'index.json'),
      JSON.stringify(
        {
          channel_id: channelId,
          channel_title: title ?? channelId,
          playlist_count: summaries.length,
          playlists: summaries,
          fetched_at: new Date().toISOString(),
        },
        null,
        2
      )
    );

    return { baseDir, playlistCount: summaries.length };
  }
}

// Parse a statistics counter string into a number; missing values (e.g. hidden
// like counts) become null.
function toCount(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
