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

async function episodeCard(heroUrl, maxWidth, maxHeight, angle) {
  const photo = await fetchImage(heroUrl);

  // Never crop episode artwork. Shrink the whole source proportionally so every edge remains visible.
  const contained = await sharp(photo)
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 93 })
    .toBuffer();

  const meta = await sharp(contained).metadata();
  const photoW = meta.width;
  const photoH = meta.height;
  const border = 12;
  const shadow = 18;
  const frameW = photoW + border * 2 + shadow * 2;
  const frameH = photoH + border * 2 + shadow * 2;

  const shadowSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}">
    <defs>
      <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
    </defs>
    <rect x="${border+shadow+3}" y="${border+shadow+7}" width="${photoW}" height="${photoH}" rx="5"
      fill="rgba(23,32,31,.24)" filter="url(#s)"/>
    <rect x="${shadow}" y="${shadow}" width="${photoW+border*2}" height="${photoH+border*2}" rx="6"
      fill="#f4ead6" stroke="rgba(84,67,45,.34)" stroke-width="2"/>
  </svg>`);

  const framed = await sharp(shadowSvg)
    .composite([{ input: contained, left: border + shadow, top: border + shadow }])
    .png()
    .toBuffer();

  return sharp(framed)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function withEpisodeImages(baseBuffer, post, width, height, platform) {
  const count = Math.min(post.episodes.length, 2);

  // The ProjectGreece logo sits in the lower part of the supplied template.
  // Keep all episode artwork inside this upper safe area.
  const safeTop = Math.round(height * (platform === "tiktok" ? 0.045 : 0.055));
  const safeBottom = Math.round(height * (platform === "tiktok" ? 0.56 : 0.565));
  const safeHeight = safeBottom - safeTop;
  const gap = Math.round(height * 0.018);

  const maxCardW = Math.round(width * (count === 1 ? 0.76 : 0.72));
  const maxCardH = count === 1
    ? Math.round(safeHeight * 0.84)
    : Math.round((safeHeight - gap) / 2 * 0.88);

  const cards = [];
  for (let i = 0; i < count; i++) {
    const episode = post.episodes[i];
    const heroUrl = resolveHeroUrl(episode.hero_image_url);
    if (!heroUrl) throw new Error(`No hero image for episode ${episode.number}`);

    // Gentle alternating tilt; deterministic so rerenders remain identical.
    const angle = (Number(episode.number) % 2 === 0 ? 1.25 : -1.25) + (i ? 0.35 : 0);
    const card = await episodeCard(heroUrl, maxCardW, maxCardH, angle);
    const meta = await sharp(card).metadata();
    cards.push({ card, width: meta.width, height: meta.height });
  }

  const totalH = cards.reduce((sum, c) => sum + c.height, 0) + gap * (cards.length - 1);
  let y = safeTop + Math.max(0, Math.round((safeHeight - totalH) / 2));
  const composites = cards.map((c) => {
    const item = {
      input: c.card,
      left: Math.round((width - c.width) / 2),
      top: y,
    };
    y += c.height + gap;
    return item;
  });

  return sharp(baseBuffer).composite(composites).jpeg({ quality: 92 }).toBuffer();
}

export async function renderPostImage(post, platform) {
  const { width, height } = CONFIG.outputs[platform];
  const base = await brandedCanvas(backgroundUrlFor(post), width, height);

  if (["episode-today", "wednesday", "friday"].includes(post.kind)) {
    return withEpisodeImages(base, post, width, height, platform);
  }

  return sharp(base).jpeg({ quality: 91 }).toBuffer();
}
