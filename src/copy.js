import { CONFIG } from "./config.js";

const ordinal = (n) => `${n}ο`;
const q = (text) => `«${text}»`;

export function mondayCopy(items) {
  if (items.mode === "evergreen") {
    const e = items.episodes[0];
    return `Από τη σειρά ${q(CONFIG.brand.seriesTitle)}.

Επεισόδιο ${String(e.number).padStart(2, "0")} — ${q(e.title_el)}

Άκουσέ το όπου ακούς podcasts.`;
  }
  const lines = items.groups.flatMap((g) => g.episodes.map((e) => `${g.label} — ${q(e.title_el)}`));
  return `Αυτή την εβδομάδα στο Project Greece.

${lines.join("\n")}

Νέα επεισόδια από τις 06:00, όπου ακούτε podcasts.`;
}

export function teaserCopy(dayLabel, episodes) {
  if (episodes.length === 1) {
    const e = episodes[0];
    return `${dayLabel} στο Project Greece.

${q(e.title_el)}

Το ${ordinal(e.number)} επεισόδιο της σειράς ${q(CONFIG.brand.seriesTitle)} θα είναι διαθέσιμο από τις 06:00, όπου ακούτε podcasts.`;
  }
  const episodeLines = episodes.map((e) => `Επεισόδιο ${String(e.number).padStart(2, "0")} — ${q(e.title_el)}`).join("\n");
  return `${dayLabel} στο Project Greece.

${episodeLines}

Δύο νέα επεισόδια της σειράς ${q(CONFIG.brand.seriesTitle)}, διαθέσιμα από τις 06:00 όπου ακούτε podcasts.`;
}
