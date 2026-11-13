import { CONFIG } from "./config.js";

export async function fetchEpisodes() {
  const url = `${CONFIG.base44.origin}/api/apps/${CONFIG.base44.appId}/entities/Episode?limit=50`;
  const response = await fetch(url, {
    headers: { "X-App-Id": CONFIG.base44.appId },
  });
  if (!response.ok) throw new Error(`Base44 Episode fetch failed: ${response.status}`);
  const records = await response.json();
  return records
    .filter((e) => e.series_slug === CONFIG.base44.seriesSlug)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export function resolveHeroUrl(hero) {
  if (!hero) return null;
  if (/^https?:\/\//i.test(hero)) return hero;
  return new URL(hero, CONFIG.base44.origin).toString();
}
