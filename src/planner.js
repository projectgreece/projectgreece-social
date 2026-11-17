import { DateTime } from "luxon";
import { CONFIG, RELEASES } from "./config.js";
import { generalLaunchCopy, episodeTodayCopy, mondayCopy, teaserCopy, evergreenCopy, repostEpisodeCopy } from "./copy.js";

const zone = CONFIG.publishing.timezone;
const releaseMap = new Map(RELEASES.map((r) => [r.number, DateTime.fromISO(r.at, { setZone: true }).setZone(zone)]));

function episodeByNumber(episodes, number) {
  return episodes.find((e) => Number(e.number) === Number(number));
}
function episodesOnDate(episodes, date) {
  return episodes.filter((e) => releaseMap.get(Number(e.number))?.toISODate() === date.toISODate());
}
function atTime(date, hour = CONFIG.publishing.postHour, minute = CONFIG.publishing.postMinute) {
  return date.set({ hour, minute, second: 0, millisecond: 0 });
}
function key(kind, dueAt, episodes = []) {
  return `${kind}-${dueAt.toISODate()}-${episodes.map((e) => e.number).join("-") || "general"}`;
}

function specialPosts(episodes) {
  const d13 = DateTime.fromISO("2026-11-13", { zone });
  const d14 = DateTime.fromISO("2026-11-14", { zone });
  const d15 = DateTime.fromISO("2026-11-15", { zone });
  const d17 = DateTime.fromISO("2026-11-17", { zone });
  const ep5 = episodeByNumber(episodes, 5), ep6 = episodeByNumber(episodes, 6);
  return [
    {
      key: key("general", atTime(d13, 12, 30)),
      kind: "general",
      dueAt: atTime(d13, 12, 30),
      episodes: [1,2,3,4].map((n)=>episodeByNumber(episodes,n)).filter(Boolean),
      text: generalLaunchCopy(),
    },
    {
      key: key("episode-today", atTime(d14), [ep5]),
      kind: "episode-today",
      dueAt: atTime(d14),
      episodes: [ep5],
      text: episodeTodayCopy(ep5, atTime(d14)),
    },
    {
      key: key("episode-today", atTime(d15), [ep6]),
      kind: "episode-today",
      dueAt: atTime(d15),
      episodes: [ep6],
      text: episodeTodayCopy(ep6, atTime(d15)),
    },
    {
      key: key("repost", atTime(d17, 12, 30), [ep5]),
      kind: "repost",
      dueAt: atTime(d17, 12, 30),
      episodes: [ep5],
      fixedImageUrl: "https://media.base44.com/images/public/6ab270b63831188bfcaa8a04/eb677bd75_a_polished_vintage_themed_poster_in_portrait_4_5_r_1.png",
      text: repostEpisodeCopy(ep5),
    },
    {
      key: key("repost", atTime(d17, 18, 30), [ep6]),
      kind: "repost",
      dueAt: atTime(d17, 18, 30),
      episodes: [ep6],
      fixedImageUrl: "https://media.base44.com/images/public/6ab270b63831188bfcaa8a04/5274f5b21_a_vintage_sepia_toned_professionally_designed_po_2.png",
      text: repostEpisodeCopy(ep6),
    },
  ];
}

function weeklyMondayPost(date, episodes) {
  const previous = [
    ...episodesOnDate(episodes, date.minus({ days: 2 })),
    ...episodesOnDate(episodes, date.minus({ days: 1 })),
  ];
  const next = [
    ...episodesOnDate(episodes, date.plus({ days: 5 })),
    ...episodesOnDate(episodes, date.plus({ days: 6 })),
  ];
  if (!previous.length || !next.length) return null;
  const start = DateTime.fromISO(CONFIG.publishing.regularStart, { zone }).startOf("day");
  const mondayIndex = Math.max(0, Math.floor(date.startOf("day").diff(start, "weeks").weeks + 1e-9));
  const dueAt = atTime(date);
  return {
    key: key("monday", dueAt, [...previous, ...next]),
    kind: "monday",
    dueAt,
    episodes: [...previous, ...next],
    previousEpisodes: previous,
    nextEpisodes: next,
    assetIndex: mondayIndex,
    text: mondayCopy(previous, next),
  };
}

function teaserPost(date, episodes, targetOffset, kind) {
  const targetDate = date.plus({ days: targetOffset });
  const targets = episodesOnDate(episodes, targetDate);
  if (!targets.length) return null;
  const dueAt = atTime(date);
  return {
    key: key(kind, dueAt, targets),
    kind,
    dueAt,
    targetDate,
    episodes: targets,
    text: teaserCopy(kind, targetDate, targets),
  };
}

function evergreenPost(date, episodes) {
  const start = DateTime.fromISO(CONFIG.publishing.evergreenStart, { zone }).startOf("day");
  if (date.weekday !== 1 || date < start) return null;
  const weeks = Math.floor(date.startOf("day").diff(start, "weeks").weeks + 1e-9);
  if (weeks < 0 || weeks >= 20) return null;
  const episode = episodeByNumber(episodes, weeks + 1);
  if (!episode) return null;
  const dueAt = atTime(date);
  return {
    key: key("evergreen", dueAt, [episode]),
    kind: "evergreen",
    dueAt,
    episodes: [episode],
    assetIndex: weeks,
    text: evergreenCopy(episode),
  };
}

export function planPosts(episodes, now = DateTime.now().setZone(zone)) {
  const end = now.plus({ days: CONFIG.publishing.lookaheadDays }).endOf("day");
  const posts = specialPosts(episodes).filter((p) => p.dueAt > now && p.dueAt <= end);
  const regularStart = DateTime.fromISO(CONFIG.publishing.regularStart, { zone }).startOf("day");
  const start = now.startOf("day") < regularStart ? regularStart : now.startOf("day");

  for (let d = start; d <= end; d = d.plus({ days: 1 })) {
    let post = null;
    if (d.weekday === 1) {
      post = d >= DateTime.fromISO(CONFIG.publishing.evergreenStart, { zone })
        ? evergreenPost(d, episodes)
        : weeklyMondayPost(d, episodes);
    } else if (d.weekday === 3) {
      post = teaserPost(d, episodes, 3, "wednesday");
    } else if (d.weekday === 5) {
      post = teaserPost(d, episodes, 2, "friday");
    }
    if (post && post.dueAt > now) posts.push(post);
  }
  return posts.sort((a,b)=>a.dueAt.toMillis()-b.dueAt.toMillis());
}
