import { DateTime } from "luxon";
import { fetchEpisodes } from "./base44.js";
import { getBufferContext, getScheduledPosts, createImagePost, editPostText, deletePost } from "./buffer.js";
import { CONFIG, RELEASES } from "./config.js";
import { renderPostImage } from "./graphics.js";
import { planPosts } from "./planner.js";
import { assertObject, uploadImage } from "./r2.js";

const mode=process.env.MODE||"dry-run",zone=CONFIG.publishing.timezone;
const slug=v=>String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const imageKey=(post,platform)=>`posts/${post.dueAt.toFormat("yyyy/LL")}/${post.key}/${platform}.jpg`;
const spotifyIds=new Map(RELEASES.map(r=>[Number(r.number),r.spotifyId]).filter(([,id])=>id));

async function publicOk(url){const r=await fetch(url,{method:"HEAD"});if(!r.ok)throw new Error(`Public media URL unreachable (${r.status}): ${url}`);}

function spotifyUrlFor(post){
  if(post.episodes.length===1){
    const id=spotifyIds.get(Number(post.episodes[0].number));
    if(id) return `https://open.spotify.com/episode/${id}`;
  }
  return CONFIG.brand.spotifyShowUrl;
}

function platformText(post,platform){
  const spotify=spotifyUrlFor(post);
  if(platform==="facebook"){
    return `${post.text}

Spotify: ${spotify}
${CONFIG.brand.websiteUrl}`;
  }
  return `${post.text}

Spotify και όλα τα επεισόδια: link στο bio.
${CONFIG.brand.website}`;
}

async function main(){
 console.log(`Project Greece social publisher · mode=${mode}`);
 const episodes=await fetchEpisodes(); if(episodes.length!==20)throw new Error(`Expected 20 episodes, found ${episodes.length}`);
 console.log(`Base44 OK: ${episodes.length} episodes`);
 const now=process.env.NOW?DateTime.fromISO(process.env.NOW,{zone}):DateTime.now().setZone(zone);
 const posts=planPosts(episodes,now);
 for(const p of posts)console.log(`PLAN ${p.dueAt.toISO()} · ${p.kind} · episodes ${p.episodes.map(e=>e.number).join(",")}`);
 if(mode==="dry-run")return;

 const buffer=await getBufferContext();
 console.log("Buffer channels:",Object.fromEntries(Object.entries(buffer.channels).map(([k,v])=>[k,`${v.displayName||v.name} (${v.id})`])));

 const sample=posts[0]||{key:"integration-test",kind:"evergreen",dueAt:now.plus({days:1}),episodes:[episodes[0]],text:"Project Greece integration test"};
 if(mode==="integration-test"){
  const img=await renderPostImage(sample,"instagram"),key=`tests/${Date.now()}-${slug(sample.key)}.jpg`,url=await uploadImage(key,img);
  await assertObject(key);await publicOk(url);console.log(`R2 OK: ${url}`);
  const teaser=posts.find(p=>p.kind==="wednesday"||p.kind==="friday")||{...sample,kind:"wednesday",episodes:[episodes[0]]};
  const img2=await renderPostImage(teaser,"instagram"),key2=`tests/${Date.now()}-${slug(teaser.key||"episode")}-episode.jpg`,url2=await uploadImage(key2,img2);
  await assertObject(key2);await publicOk(url2);console.log(`R2 episode graphic OK: ${url2}`);
  console.log("Integration test passed: Base44 + Sharp/SVG + R2 + Buffer auth/channels");return;
 }
 if(mode!=="publish")throw new Error(`Unknown MODE: ${mode}`);

 const scheduledByOrg=new Map();
 for(const org of buffer.organizations)scheduledByOrg.set(org.id,await getScheduledPosts(org.id));
 for(const post of posts)for(const platform of ["facebook","instagram","tiktok"]){
  const channel=buffer.channels[platform],existing=scheduledByOrg.get(channel.organizationId)||[],dueIso=post.dueAt.toUTC().toISO();
  const text=platformText(post,platform);
  const sameSlot=existing.filter(x=>x.channelId===channel.id&&Math.abs(Date.parse(x.dueAt)-Date.parse(dueIso))<1000);

  if(sameSlot.length){
    let keep=sameSlot.find(x=>x.text===text)||sameSlot[0];
    if(keep.text===text){
      console.log(`Skip duplicate ${platform} ${post.key}: ${keep.id}`);
    }else{
      const existingImageUrl=`${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/,"")}/${imageKey(post,platform)}`;
      const edited=await editPostText(keep.id,text,platform,post.episodes.length===1?post.episodes[0].title_el:"Project Greece",existingImageUrl);
      console.log(`Updated ${platform}: ${edited.id} @ ${edited.dueAt}`);
      keep.text=text;
    }
    for(const extra of sameSlot.filter(x=>x.id!==keep.id)){
      await deletePost(extra.id);
      console.log(`Deleted duplicate ${platform}: ${extra.id} @ ${extra.dueAt}`);
      const idx=existing.findIndex(x=>x.id===extra.id); if(idx>=0) existing.splice(idx,1);
    }
    continue;
  }

  const image=await renderPostImage(post,platform),url=await uploadImage(imageKey(post,platform),image);await publicOk(url);
  const created=await createImagePost({channel,text,dueAt:post.dueAt,imageUrl:url,platform,title:post.episodes.length===1?post.episodes[0].title_el:"Project Greece"});
  console.log(`Scheduled ${platform}: ${created.id} @ ${created.dueAt}`);existing.push(created);
 }
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1);});
