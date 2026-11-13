import sharp from "sharp";
import { CONFIG } from "./config.js";
import { resolveHeroUrl } from "./base44.js";

const { colors } = CONFIG.brand;

function esc(v=""){return String(v).replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]));}
function wrap(text,max){const w=String(text).split(/\s+/),out=[];let line="";for(const x of w){const n=line?`${line} ${x}`:x;if(n.length>max&&line){out.push(line);line=x}else line=n}if(line)out.push(line);return out;}
function t(lines,x,y,lh,a=""){return lines.map((s,i)=>`<text x="${x}" y="${y+i*lh}" ${a}>${esc(s)}</text>`).join("");}
function wm(x,y,size,light=false){return `<text x="${x}" y="${y}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="700"><tspan fill="${light?colors.white:colors.ink}">Project</tspan><tspan fill="${colors.teal}">Greece</tspan></text>`;}

async function fetchImage(url){const r=await fetch(url);if(!r.ok)throw new Error(`Image download failed ${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer());}

function mondaySvg(width,height,post,platform){
 const pad=width*.075,dark=Number(post.dueAt.toFormat("W"))%2===1,bg=dark?colors.tealDark:colors.paper,ink=dark?colors.white:colors.ink;
 const heading=post.kind==="evergreen"?"Από το αρχείο του Project Greece":"Αυτή την εβδομάδα";
 const lines=post.kind==="evergreen"
 ?[`Επεισόδιο ${String(post.episodes[0].number).padStart(2,"0")}`,...wrap(post.episodes[0].title_el,platform==="facebook"?44:35)]
 :post.episodes.length>2
 ?[`${post.episodes.length} νέα επεισόδια`,`Επεισόδια ${post.episodes[0].number}–${post.episodes.at(-1).number}`,"Σάββατο & Κυριακή"]
 :post.groups.flatMap(g=>g.episodes.flatMap(e=>[`${g.label} · Επεισόδιο ${String(e.number).padStart(2,"0")}`,...wrap(e.title_el,platform==="facebook"?46:34)]));
 let y=height*.43,body="",fs=platform==="facebook"?28:34,lh=fs*1.28;
 for(const line of lines){body+=`<text x="${pad}" y="${y}" font-family="DejaVu Serif,serif" font-size="${fs}" fill="${ink}">${esc(line)}</text>`;y+=lh;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/><circle cx="${width*.72}" cy="${height*.28}" r="${Math.min(width,height)*.3}" fill="none" stroke="${dark?"rgba(255,255,255,.16)":"rgba(23,32,31,.14)"}" stroke-width="2"/><path d="M0 ${height*.78} C ${width*.25} ${height*.68}, ${width*.65} ${height*.92}, ${width} ${height*.74}" fill="none" stroke="${colors.terracotta}" stroke-width="5"/>${wm(pad,height*.14,platform==="facebook"?38:44,dark)}<text x="${pad}" y="${height*.30}" font-family="DejaVu Serif,serif" font-size="${platform==="facebook"?54:62}" fill="${ink}" font-weight="600">${esc(heading)}</text>${body}<text x="${pad}" y="${height*.91}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${platform==="facebook"?20:24}" fill="${ink}" opacity=".72">Όπου ακούτε podcasts</text></svg>`;
}

function overlaySvg(width,height,post,platform){
 const pad=width*.065,panelY=height-(platform==="facebook"?height*.48:height*.42),multi=post.episodes.length>1;
 const titleSize=multi?(platform==="facebook"?30:39):(platform==="facebook"?42:52),epSize=multi?(platform==="facebook"?20:25):(platform==="facebook"?24:30);
 let y=panelY+(height-panelY)*.34,body="";
 for(const e of post.episodes){
  body+=`<text x="${pad}" y="${y}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${epSize}" fill="${colors.terracotta}" font-weight="700">Επεισόδιο ${String(e.number).padStart(2,"0")}</text>`;y+=epSize*1.55;
  const ls=wrap(e.title_el,multi?(platform==="facebook"?47:36):(platform==="facebook"?39:31)).slice(0,multi?2:3);
  body+=t(ls,pad,y,titleSize*1.12,`font-family="DejaVu Serif,serif" font-size="${titleSize}" fill="${colors.white}" font-weight="600"`);y+=ls.length*titleSize*1.12+titleSize*.55;
 }
 const label=post.kind==="wednesday"?"ΤΟ ΣΑΒΒΑΤΟ":"ΤΗΝ ΚΥΡΙΑΚΗ";
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17201f" stop-opacity="0"/><stop offset=".36" stop-color="#17201f" stop-opacity=".52"/><stop offset="1" stop-color="#17201f" stop-opacity=".94"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>${wm(pad,height*.09,platform==="facebook"?34:42,true)}<text x="${pad}" y="${panelY+(height-panelY)*.17}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${platform==="facebook"?20:24}" fill="${colors.white}" opacity=".82" letter-spacing="4">${label}</text>${body}<text x="${pad}" y="${height*.95}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${platform==="facebook"?18:22}" fill="${colors.white}" opacity=".72">Από τις 06:00 · όπου ακούτε podcasts</text></svg>`;
}

export async function renderPostImage(post,platform){
 const {width,height}=CONFIG.outputs[platform];
 if(post.kind==="monday"||post.kind==="evergreen") return sharp(Buffer.from(mondaySvg(width,height,post,platform))).jpeg({quality:91}).toBuffer();
 const hero=resolveHeroUrl(post.episodes[0].hero_image_url); if(!hero)throw new Error(`No hero image for episode ${post.episodes[0].number}`);
 const base=await sharp(await fetchImage(hero)).resize(width,height,{fit:"cover",position:sharp.strategy.attention}).modulate({saturation:.86,brightness:.95}).toBuffer();
 return sharp(base).composite([{input:Buffer.from(overlaySvg(width,height,post,platform)),top:0,left:0}]).jpeg({quality:91}).toBuffer();
}
