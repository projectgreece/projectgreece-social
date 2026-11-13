import { CONFIG } from "./config.js";

const q = (text) => `«${text}»`;
const ordinal = (n) => `${n}ο`;
const dateLabel = (dt) => dt.toFormat("dd/LL");

export function generalLaunchCopy() {
  return `Τα 4 πρώτα επεισόδια της σειράς ${q(CONFIG.brand.seriesTitle)} είναι ήδη στον αέρα.

Ακούστε τα στο ProjectGreece.gr και όπου ακούτε podcasts.`;
}

export function episodeTodayCopy(episode, dueAt) {
  return `Σήμερα, ${dueAt.setLocale("el").toFormat("cccc")} ${dateLabel(dueAt)}, ακούστε το ${ordinal(episode.number)} επεισόδιο της σειράς ${q(CONFIG.brand.seriesTitle)}.

${q(episode.title_el)}

Διαθέσιμο από τις 06:00 στο ProjectGreece.gr και όπου ακούτε podcasts.`;
}

function titles(episodes) {
  return episodes.map((e) => q(e.title_el)).join(episodes.length > 1 ? " και " : "");
}

export function mondayCopy(previous, next) {
  return `Αυτό το σαββατοκύριακο ακούσαμε για ${titles(previous)}.

Το επόμενο σαββατοκύριακο προχωράμε το ταξίδι μας με ${titles(next)}.

Όλα τα επεισόδια στο ProjectGreece.gr και όπου ακούτε podcasts.`;
}

export function teaserCopy(kind, targetDate, episodes) {
  const day = kind === "wednesday" ? "Αυτό το Σάββατο" : "Αυτή την Κυριακή";
  if (episodes.length === 1) {
    const e = episodes[0];
    return `${day} ${dateLabel(targetDate)} ${kind === "wednesday" ? "ακούστε το νέο μας επεισόδιο" : `παρουσιάζουμε το ${ordinal(e.number)} επεισόδιο της σειράς μας`} ${q(e.title_el)}.

Το ταξίδι μας προχωράει. Όλα τα επεισόδια στο ProjectGreece.gr και όπου ακούτε podcasts.`;
  }
  return `${day} ${dateLabel(targetDate)} παρουσιάζουμε δύο νέα επεισόδια:

${episodes.map((e) => `Επεισόδιο ${String(e.number).padStart(2, "0")} — ${q(e.title_el)}`).join("\n")}

Όλα τα επεισόδια στο ProjectGreece.gr και όπου ακούτε podcasts.`;
}

export function evergreenCopy(episode) {
  return `Ακούστε ξανά το επεισόδιο ${String(episode.number).padStart(2, "0")} — ${q(episode.title_el)}.

Από τη σειρά ${q(CONFIG.brand.seriesTitle)}.

Στο ProjectGreece.gr και όπου ακούτε podcasts.`;
}
