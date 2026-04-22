/** Extract 11-char YouTube video id from common URL shapes (or raw id). */
export function extractYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  const short = u.match(/youtu\.be\/([^?&/]+)/);
  if (short?.[1]) return short[1].slice(0, 11);
  const embed = u.match(/youtube\.com\/embed\/([^?&/]+)/);
  if (embed?.[1]) return embed[1].slice(0, 11);
  const v = u.match(/[?&]v=([^&]+)/);
  if (v?.[1]) return v[1].slice(0, 11);
  return null;
}
