import { DateTime } from "luxon";
import { CONFIG, RELEASES } from "./config.js";
import { mondayCopy, teaserCopy } from "./copy.js";

const zone = CONFIG.publishing.timezone;
const releaseMap = new Map(RELEASES.map((r) => [r.number, DateTime.fromISO(r.at, { setZone: true }).setZone(zone)]));

function episodesOnDate(episodes, date) {
  return episodes.filter((e) => releaseMap.get(Number(e.number))?.toISODate() === date.toISODate());
}

function atPostTime(date) {
  return date.set({ hour: CONFIG.publishing.postHour, minute: CONFIG.publishing.postMinute, second: 0, millisecond: 0 });
}

function postKey(kind, dueAt, episodes) {
  return `${kind}-${dueAt.toISODate()}-${episodes.map((e) => e.number).join("-")}`;
}

function weeklyMondayPost(date, episodes) {
  const saturday = date.plus({ days: 5 });
  const sunday = date.plus({ days: 6 });
  const satEpisodes = episodesOnDate(episodes, saturday);
  const sunEpisodes = episodesOnDate(episodes, sunday);
  const all = [...satEpisodes, ...sunEpisodes];
  if (!all.length) return null;
  const groups = [];
  if (satEpisodes.length) groups.push({ label: "Σάββατο", episodes: satEpisodes });
  if (sunEpisodes.length) groups.push({ label: "Κυριακή", episodes: sunEpisodes });
  const dueAt = atPostTime(date);
  return {
    key: postKey("monday", dueAt, all),
    kind: "monday",
    dueAt,
    episodes: all,
    groups,
    text: mondayCopy({ mode: "weekly", groups }),
  };
}

function teaserPost(date, episodes, targetOffset, kind, dayLabel) {
  const target = date.plus({ days: targetOffset });
  const targets = episodesOnDate(episodes, target);
  if (!targets.length) return null;
  const dueAt = atPostTime(date);
  return {
    key: postKey(kind, dueAt, targets),
    kind,
    dueAt,
    episodes: targets,
    text: teaserCopy(dayLabel, targets),
  };
}

function evergreenMondayPost(date, episodes) {
  const start = DateTime.fromISO(CONFIG.publishing.evergreenStart, { zone }).startOf("day");
  if (date < start || date.weekday !== 1) return null;
  const weeks = Math.floor(date.startOf("day").diff(start, "weeks").weeks + 1e-9);
  if (weeks < 0 || weeks >= 20) return null;
  const episode = episodes.find((e) => Number(e.number) === weeks + 1);
  if (!episode) return null;
  const dueAt = atPostTime(date);
  return {
    key: postKey("evergreen", dueAt, [episode]),
    kind: "evergreen",
    dueAt,
    episodes: [episode],
    text: mondayCopy({ mode: "evergreen", episodes: [episode] }),
  };
}

export function planPosts(episodes, now = DateTime.now().setZone(zone)) {
  const from = DateTime.fromISO(CONFIG.publishing.activeFrom, { zone }).startOf("day");
  const start = now.startOf("day") < from ? from : now.startOf("day");
  const end = now.plus({ days: CONFIG.publishing.lookaheadDays }).endOf("day");
  const posts = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    let post = null;
    if (d.weekday === 1) {
      post = d >= DateTime.fromISO(CONFIG.publishing.evergreenStart, { zone })
        ? evergreenMondayPost(d, episodes)
        : weeklyMondayPost(d, episodes);
    }
    if (d.weekday === 3) post = teaserPost(d, episodes, 3, "wednesday", "Το Σάββατο");
    if (d.weekday === 5) post = teaserPost(d, episodes, 2, "friday", "Την Κυριακή");
    if (post && post.dueAt > now) posts.push(post);
  }
  return posts;
}
