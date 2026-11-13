import { DateTime } from "luxon";
import { fetchEpisodes } from "./base44.js";
import { getBufferContext, getScheduledPosts, createImagePost } from "./buffer.js";
import { CONFIG } from "./config.js";
import { renderPostImage } from "./graphics.js";
import { planPosts } from "./planner.js";
import { assertObject, uploadImage } from "./r2.js";

const mode=process.env.MODE||"dry-run",zone=CONFIG.publishing.timezone;
const slug=v=>String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const imageKey=(post,platform)=>`posts/${post.dueAt.toFormat("yyyy/LL")}/${post.key}/${platform}.jpg`;
async function publicOk(url){const r=await fetch(url,{method:"HEAD"});if(!r.ok)throw new Error(`Public media URL unreachable (${r.status}): ${url}`);}

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
  const dup=existing.find(x=>x.channelId===channel.id&&Math.abs(Date.parse(x.dueAt)-Date.parse(dueIso))<1000&&x.text===post.text);
  if(dup){console.log(`Skip duplicate ${platform} ${post.key}: ${dup.id}`);continue;}
  const image=await renderPostImage(post,platform),url=await uploadImage(imageKey(post,platform),image);await publicOk(url);
  const created=await createImagePost({channel,text:post.text,dueAt:post.dueAt,imageUrl:url,platform,title:post.episodes.length===1?post.episodes[0].title_el:"Project Greece"});
  console.log(`Scheduled ${platform}: ${created.id} @ ${created.dueAt}`);existing.push(created);
 }
}
main().catch(e=>{console.error(e?.stack||e);process.exit(1);});
