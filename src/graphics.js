import sharp from "sharp";
import { CONFIG, SOCIAL_ASSETS } from "./config.js";
import { resolveHeroUrl } from "./base44.js";

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function brandedCanvas(assetUrl, width, height) {
  const source = await fetchImage(assetUrl);
  const blurred = await sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .blur(18)
    .modulate({ brightness: 0.92, saturation: 0.9 })
    .toBuffer();

  const contained = await sharp(source)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp(blurred).composite([{ input: contained, gravity: "centre" }]).png().toBuffer();
}

function backgroundUrlFor(post) {
  if (post.kind === "monday") return SOCIAL_ASSETS.monday[post.assetIndex % SOCIAL_ASSETS.monday.length];
  if (post.kind === "evergreen") return SOCIAL_ASSETS.alter[post.assetIndex % SOCIAL_ASSETS.alter.length];
  return SOCIAL_ASSETS.general;
}

async function episodeCard(heroUrl, width, height) {
  const photo = await fetchImage(heroUrl);
  const innerW = width - 12;
  const innerH = height - 12;
  const resized = await sharp(photo)
    .resize(innerW, innerH, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 92 })
    .toBuffer();

  const frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="4" y="4" width="${width-8}" height="${height-8}" rx="12" fill="#fffdfa" stroke="rgba(23,32,31,.18)" stroke-width="2"/>
  </svg>`);

  return sharp(frame)
    .composite([{ input: resized, top: 6, left: 6 }])
    .png()
    .toBuffer();
}

async function withEpisodeImages(baseBuffer, post, width, height, platform) {
  const count = Math.min(post.episodes.length, 2);
  const cardW = Math.round(width * 0.76);
  const totalSafeH = Math.round(height * (platform === "tiktok" ? 0.47 : 0.44));
  const gap = Math.round(height * 0.018);
  const cardH = count === 1
    ? Math.round(totalSafeH * 0.72)
    : Math.round((totalSafeH - gap) / 2);
  const x = Math.round((width - cardW) / 2);
  const startY = Math.round(height * 0.06);
  const composites = [];

  for (let i = 0; i < count; i++) {
    const heroUrl = resolveHeroUrl(post.episodes[i].hero_image_url);
    if (!heroUrl) throw new Error(`No hero image for episode ${post.episodes[i].number}`);
    const card = await episodeCard(heroUrl, cardW, cardH);
    composites.push({ input: card, left: x, top: startY + i * (cardH + gap) });
  }

  return sharp(baseBuffer).composite(composites).jpeg({ quality: 91 }).toBuffer();
}

export async function renderPostImage(post, platform) {
  const { width, height } = CONFIG.outputs[platform];
  const base = await brandedCanvas(backgroundUrlFor(post), width, height);

  if (["episode-today", "wednesday", "friday"].includes(post.kind)) {
    return withEpisodeImages(base, post, width, height, platform);
  }

  return sharp(base).jpeg({ quality: 91 }).toBuffer();
}
