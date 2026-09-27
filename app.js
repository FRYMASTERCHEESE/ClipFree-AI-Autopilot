import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'clipfree_high_value_settings_v1';
const USED_TOPICS_KEY = 'clipfree_high_value_topics_v1';
const NETWORK_TIMEOUT_MS = 45000;
const FFMPEG_LOAD_TIMEOUT_MS = 90000;
const FFMPEG_EXEC_TIMEOUT_MS = 240000;
const TTS_WORKER_TIMEOUT_MS = 180000;
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
].join(' ');

const NICHES = {
  insurance: {
    label: 'Insurance Education', short: 'Insurance', categoryId: '27', valueLabel: 'Very high advertiser demand',
    keywords: ['insurance explained','insurance basics','deductible','premium','coverage','claims','policy terms'],
    topics: [
      'Insurance premium vs deductible explained',
      'How an insurance claim works from start to finish',
      'What policy exclusions actually mean',
      'Term life vs whole life insurance basics',
      'What liability coverage is designed to do',
      'Why insurance quotes can be different',
      'What an insurance excess means',
      'Common insurance terms people misunderstand'
    ],
    disclaimer: 'General educational information only. Policy terms, eligibility and laws vary by provider and location.'
  },
  finance: {
    label: 'Personal Finance & Investing Education', short: 'Finance', categoryId: '27', valueLabel: 'Very high advertiser demand',
    keywords: ['personal finance','money basics','investing basics','financial literacy','credit','banking','compound interest'],
    topics: [
      'How compound interest actually works',
      'APR vs APY explained in plain English',
      'What an index fund actually is',
      'How credit card interest is calculated',
      'Emergency fund vs investing: the decision framework',
      'What diversification means and why it matters',
      'How inflation changes purchasing power',
      'Gross income vs net income explained'
    ],
    disclaimer: 'General educational information only — not personal financial or investment advice.'
  },
  legal: {
    label: 'Legal Education', short: 'Legal', categoryId: '27', valueLabel: 'Very high advertiser demand',
    keywords: ['legal education','law explained','contracts','copyright','trademark','consumer rights','legal basics'],
    topics: [
      'Trademark vs copyright explained',
      'What makes a contract legally meaningful',
      'What small claims court is designed for',
      'Copyright basics creators should understand',
      'What a cease and desist letter actually means',
      'The difference between civil and criminal cases',
      'What terms and conditions are for',
      'What a non-disclosure agreement is'
    ],
    disclaimer: 'General legal education only — not legal advice. Laws and procedures vary by jurisdiction.'
  },
  realestate: {
    label: 'Real Estate & Mortgages', short: 'Real Estate', categoryId: '27', valueLabel: 'High advertiser demand',
    keywords: ['real estate','mortgage explained','home buying','property finance','interest rates','loan to value','home equity'],
    topics: [
      'Fixed vs variable mortgage rates explained',
      'What loan-to-value ratio means',
      'How mortgage interest works',
      'What closing costs are',
      'Principal vs interest on a mortgage',
      'What mortgage pre-approval actually means',
      'Renting vs buying: the decision framework',
      'What equity in a home means'
    ],
    disclaimer: 'General educational information only — not mortgage, property or financial advice.'
  },
  'b2b-ai': {
    label: 'AI, SaaS & Business Software', short: 'AI & SaaS', categoryId: '28', valueLabel: 'High advertiser demand',
    keywords: ['AI tools','SaaS','business software','automation','AI agents','productivity software','workflow automation'],
    topics: [
      'AI agents vs chatbots explained',
      'What retrieval augmented generation actually does',
      'How CRM automation works',
      'What SaaS pricing models mean',
      'How businesses use AI workflow automation',
      'API vs webhook explained for beginners',
      'What a vector database is used for',
      'How no-code automation tools connect apps'
    ],
    disclaimer: 'Product capabilities and pricing can change. Check current provider documentation before buying or deploying software.'
  },
  business: {
    label: 'Business & Marketing', short: 'Business', categoryId: '27', valueLabel: 'High advertiser demand',
    keywords: ['business basics','marketing','entrepreneurship','cash flow','profit','customer acquisition','conversion rate'],
    topics: [
      'Gross profit vs net profit explained',
      'Cash flow vs profit: why they are different',
      'What customer acquisition cost means',
      'What recurring revenue means',
      'How a break-even point works',
      'What conversion rate actually measures',
      'Revenue vs profit explained',
      'What a sales funnel is designed to do'
    ],
    disclaimer: 'General business education only. Results vary by business, market and execution.'
  }
};

const AUTO_ORDER = ['insurance','finance','legal','realestate','b2b-ai','business'];

const AUTO_PLAYLISTS = {
  finance: { title:'Money & Finance Explained', description:'Clear educational videos about money, personal finance, banking and investing concepts.' },
  insurance: { title:'Insurance Explained', description:'Clear educational videos about insurance terms, coverage, policies, claims and common concepts.' },
  legal: { title:'Law Explained', description:'General legal education that explains legal concepts, rights, contracts and terminology in plain English.' },
  realestate: { title:'Real Estate & Mortgages Explained', description:'Educational explainers about property, mortgages, home buying and real-estate finance concepts.' },
  'b2b-ai': { title:'AI & SaaS Explained', description:'Practical explainers about AI, SaaS, business software, automation and digital tools.' },
  business: { title:'Business & Marketing Explained', description:'Educational videos about business, marketing, revenue, profit, customer acquisition and growth concepts.' }
};
const FORMAT_PLAYLISTS = {
  short: { title:'High Value Shorts', description:'Fast, clear Shorts from High Value Explained.' },
  long: { title:'High Value Deep Dives', description:'Long-form educational explainers from High Value Explained.' }
};

const state = {
  settings: { geminiKey:'', geminiTextModel:'gemini-3.7-flash', geminiTtsModel:'gemini-3.1-flash-tts-preview', googleClientId:'' },
  plan: null,
  videoBlob: null,
  videoFile: null,
  thumbnailBlob: null,
  srt: '',
  ffmpeg: null,
  kokoro: null,
  accessToken: '',
  expiresAt: 0,
  channel: null,
  recentVideos: [],
  analytics: null,
  currentNicheIndex: 0,
  renderUrls: [],
  playlistCache: new Map(),
  playlistCacheLoaded: false
};

const els = {
  niche: $('nicheSelect'), format: $('formatSelect'), market: $('marketPreset'), revenueGoal: $('revenueGoal'), batch: $('batchCount'), voice: $('voiceSelect'),
  freeOnly: $('freeOnly'), fullAuto: $('fullAutopilot'), rights: $('rightsConfirm'),
  generate: $('generatePlan'), createVideo: $('createVideo'), runBatch: $('runBatch'), status: $('autopilotStatus'), progress: $('autopilotProgress'),
  topic: $('topicOutput'), title: $('titleOutput'), description: $('descriptionOutput'), tags: $('tagsOutput'), hashtags: $('hashtagsOutput'), thumbText: $('thumbnailOutput'), script: $('scriptOutput'),
  variants: $('titleVariants'), quality: $('qualityChecks'), score: $('seoScore'), preview: $('videoPreview'), previewEmpty: $('previewEmpty'), downloadVideo: $('downloadVideo'), downloadThumbnail: $('downloadThumbnail'),
  connect: $('connectYoutube'), disconnect: $('disconnectYoutube'), youtubeStatus: $('youtubeStatus'), youtubeBanner: $('youtubeBanner'),
  privacy: $('privacySelect'), schedule: $('scheduleAt'), fastUpload: $('fastUpload'), autoPlaylist: $('autoPlaylist'), playlistName: $('playlistName'), createPlaylists: $('createPlaylists'), playlistStatus: $('playlistStatus'), madeForKids: $('madeForKids'), uploadCaptions: $('uploadCaptions'), uploadThumbnail: $('uploadThumbnail'), uploadButton: $('uploadYoutube'), uploadProgress: $('uploadProgress'), uploadResult: $('uploadResult'), publishGuard: $('publishGuard'),
  refreshAnalytics: $('refreshAnalytics'), metricViews: $('metricViews'), metricWatch: $('metricWatch'), metricSubs: $('metricSubs'), metricChannel: $('metricChannel'), metricGoal: $('metricGoal'), metricMarkets: $('metricMarkets'), recentVideos: $('recentVideos'), nextIdeas: $('nextIdeas'),
  geminiKey: $('geminiApiKey'), geminiTextModel: $('geminiTextModel'), geminiTtsModel: $('geminiTtsModel'), saveAi: $('saveAi'), aiStatus: $('aiStatus'), googleClientId: $('googleClientId'), saveYoutube: $('saveYoutube'), youtubeSetupStatus: $('youtubeSetupStatus')
};

function clean(value='') { return String(value || '').replace(/\s+/g,' ').trim(); }
function esc(value='') { return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function slug(value='') { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,72) || 'clipfree-video'; }
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
function setStatus(text,type='subtle'){ els.status.textContent=text; els.status.className=`notice ${type}`; }
function setProgress(n){ els.progress.style.width=`${clamp(Number(n)||0,0,100)}%`; }
function formatNumber(value){ return new Intl.NumberFormat(undefined,{notation:Number(value)>=10000?'compact':'standard',maximumFractionDigits:1}).format(Number(value)||0); }
function dateYmd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function mb(bytes){return (Number(bytes||0)/1048576).toFixed(Number(bytes||0)>=10485760?1:2);}
function turboEnabled(){return els.fastUpload?.checked!==false;}
function mobileSafeRender(){
  const ua=navigator.userAgent||'';
  const lowMemory=Number(navigator.deviceMemory||0)>0&&Number(navigator.deviceMemory||0)<=6;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)||lowMemory;
}
function renderSourceSize(plan){
  const vertical=plan.format!=='long';
  if(mobileSafeRender()) return vertical?{w:720,h:1280}:{w:1280,h:720};
  return vertical?{w:1080,h:1920}:{w:1920,h:1080};
}
function finalVideoSize(plan){return plan.format!=='long'?{w:1080,h:1920}:{w:1920,h:1080};}

async function withTimeout(promise,ms,label='Operation'){
  let timer;
  try{
    return await Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out. Please check your connection and try again.`)),ms);})
    ]);
  } finally { clearTimeout(timer); }
}
async function fetchWithTimeout(url,options={},ms=NETWORK_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...options,signal:controller.signal});}
  catch(err){
    if(err?.name==='AbortError')throw new Error('Network request timed out. Please try again.');
    throw err;
  } finally {clearTimeout(timer);}
}
let wakeLockSentinel=null;
async function keepScreenAwake(){
  if(!('wakeLock' in navigator)||wakeLockSentinel)return;
  try{wakeLockSentinel=await navigator.wakeLock.request('screen');wakeLockSentinel.addEventListener?.('release',()=>{wakeLockSentinel=null;});}catch{}
}
async function releaseWakeLock(){
  try{await wakeLockSentinel?.release?.();}catch{}
  wakeLockSentinel=null;
}
function resetPlaylistCache(){
  state.playlistCache.clear();
  state.playlistCacheLoaded=false;
}

function marketContext(){
  const value=els.market?.value||'premium';
  if(value==='us') return {label:'United States audience',countries:['United States'],short:'US'};
  if(value==='global') return {label:'Global English-speaking audience',countries:['Global English'],short:'Global'};
  return {label:'Premium English-speaking markets',countries:['United States','Canada','United Kingdom','Australia','New Zealand'],short:'US · CA · UK · AU · NZ'};
}
function revenueGoalValue(){ return Math.max(0,Number(els.revenueGoal?.value||30000)||0); }
function renderGrowthTargets(){
  const market=marketContext();
  if(els.metricGoal) els.metricGoal.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(revenueGoalValue());
  if(els.metricMarkets) els.metricMarkets.textContent=market.short;
}
function setAgent(name,text,kind='idle'){
  const root=document.querySelector(`[data-agent="${name}"]`);
  if(!root)return;
  const badge=root.querySelector('[data-state]');
  badge.textContent=text;
  badge.className=kind;
}
function resetAgents(){ ['strategy','research','script','seo','thumbnail','production','publishing','analytics'].forEach(n=>setAgent(n,'Ready','')); }

function loadSettings(){
  try { Object.assign(state.settings,JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')); } catch {}
  els.geminiKey.value=state.settings.geminiKey||'';
  els.geminiTextModel.value=state.settings.geminiTextModel||'gemini-3.7-flash';
  els.geminiTtsModel.value=state.settings.geminiTtsModel||'gemini-3.1-flash-tts-preview';
  els.googleClientId.value=state.settings.googleClientId||'';
  if(els.market) els.market.value=state.settings.marketPreset||'premium';
  if(els.revenueGoal) els.revenueGoal.value=state.settings.revenueGoal||30000;
  if(els.fastUpload) els.fastUpload.checked=state.settings.fastUpload!==false;
  els.aiStatus.className=`notice ${state.settings.geminiKey?'good':'subtle'}`;
  els.aiStatus.textContent=state.settings.geminiKey
    ? 'Gemini settings saved only in this browser. AI planning and narration will be attempted within the quota available to your key.'
    : 'No Gemini key saved. The local $0 planner and original graphics renderer still work.';
  els.youtubeSetupStatus.className=`notice ${state.settings.googleClientId?'good':'subtle'}`;
  els.youtubeSetupStatus.textContent=state.settings.googleClientId
    ? 'OAuth Client ID saved on this device. You can connect YouTube.'
    : 'Enable YouTube Data API v3 and YouTube Analytics API in Google Cloud, then create an OAuth 2.0 Web client.';
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(state.settings)); }

function usedTopics(){
  try { const a=JSON.parse(localStorage.getItem(USED_TOPICS_KEY)||'[]'); return new Set(Array.isArray(a)?a:[]); } catch { return new Set(); }
}
function rememberTopic(topic){
  const set=usedTopics(); set.add(clean(topic).toLowerCase());
  try { localStorage.setItem(USED_TOPICS_KEY,JSON.stringify([...set].slice(-250))); } catch {}
}
function pickNiche(){
  const selected=els.niche.value;
  if(selected!=='auto'&&NICHES[selected]) return selected;
  const day=Math.floor(Date.now()/86400000);
  return AUTO_ORDER[day%AUTO_ORDER.length];
}
function pickTopic(key){
  const profile=NICHES[key]; const used=usedTopics();
  for(let i=0;i<profile.topics.length;i++){
    const idx=(state.currentNicheIndex+i)%profile.topics.length;
    const t=profile.topics[idx];
    if(!used.has(t.toLowerCase())){state.currentNicheIndex=idx+1;rememberTopic(t);return t;}
  }
  const t=profile.topics[state.currentNicheIndex%profile.topics.length]; state.currentNicheIndex++; rememberTopic(t); return t;
}

function localScript(topic,profile,format){
  const hook=`Most people hear this term without anyone explaining what it actually means. Here is the simple version.`;
  const concept=topic.replace(/\bexplained\b/ig,'').replace(/[.:]+$/,'').trim();
  const short=`${hook} ${concept} is easiest to understand by separating the definition from the decision it supports. First, define the term in plain English. Next, use a simple generic example with round numbers or a common business situation. Then check the limits: fees, eligibility, provider terms, local rules or risk can change the answer for a real person. The key takeaway is to understand what the number or term measures before comparing options. Save this explanation for later, and check primary documentation before acting. ${profile.disclaimer}`;
  const long=`${hook} Today we are breaking down ${concept} in plain English. Start with the definition: understand what the term measures, who uses it, and why it exists. Then separate the headline number from the details that can change a real outcome. A simple generic example is useful because it shows the mechanics without pretending every viewer has the same situation. Next, compare the common alternatives and the trade-offs each one is designed to handle. Pay attention to fees, exclusions, timing, eligibility, provider terms, jurisdiction and risk where they apply. A good decision framework is to ask: what does this option cost, what does it protect or provide, what can change, and which official document should I verify? Avoid choosing from a headline alone. The final takeaway is simple: understand the mechanism first, then compare the details that matter to your own situation using current primary information or qualified professional help when appropriate. ${profile.disclaimer}`;
  return {hook,script:format==='long'?long:short};
}

function localPlan(key){
  const profile=NICHES[key]; const format=els.format.value; const topic=pickTopic(key); const {hook,script}=localScript(topic,profile,format);
  const core=topic.replace(/[.:]+$/,'').trim();
  const titleCandidates=[
    core,
    `${core.replace(/ explained/i,'')} Explained Simply`,
    `${profile.short} Basics: ${core.replace(/\bexplained\b/ig,'').trim()}`,
    `Before You Decide, Understand ${core.replace(/^what /i,'')}`,
    `The ${profile.short} Concept Beginners Often Miss`
  ].map(x=>clean(x).slice(0,86));
  const chosen=titleCandidates.find(x=>x.length>=32&&x.length<=70)||titleCandidates[0].slice(0,70);
  const tags=[...new Set([...profile.keywords,topic.toLowerCase(),`${profile.short.toLowerCase()} explained`,'beginner guide','educational video',format==='short'?'youtube shorts':'explainer video'])].slice(0,15);
  const hashRoot=profile.short.replace(/[^a-z0-9]/gi,'');
  const hashtags=(format==='short'?['#Shorts',`#${hashRoot}`,'#Explained','#Education']:[`#${hashRoot}`,'#Explained','#Education']).slice(0,5);
  const description=`${chosen}\n\nA clear, beginner-friendly explanation of ${topic.toLowerCase()}. This video focuses on definitions, examples and the questions worth checking before making a decision.\n\n${profile.disclaimer}\n\n${hashtags.join(' ')}`;
  return {
    niche:key,nicheLabel:profile.label,valueLabel:profile.valueLabel,categoryId:profile.categoryId,format,topic,
    searchIntent:'Beginner educational / commercial research',audience:marketContext().label,
    chosenTitle:chosen,titleCandidates,hook,script,description,tags,hashtags,
    thumbnailTexts:[core.split(/\s+/).slice(0,4).join(' ').toUpperCase(),`${profile.short} EXPLAINED`.toUpperCase(),'KNOW THIS FIRST','SIMPLE BREAKDOWN'],
    verificationQueries:[`Verify current definitions and terminology for: ${topic}`,'Check any location-specific law, policy, rate or product detail before publishing.'],
    riskNotes:['Avoid personalized recommendations.','Avoid guaranteed savings, earnings, legal outcomes or approval claims.','Avoid time-sensitive figures unless independently verified.'],
    disclaimer:profile.disclaimer,source:'local'
  };
}

async function geminiJson(prompt,key,model){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response=await fetchWithTimeout(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.7,responseMimeType:'application/json'}})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message||`Gemini request failed (${response.status}).`);
  const raw=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  if(!raw) throw new Error('Gemini returned no text.');
  return JSON.parse(raw.replace(/^\s*```json/i,'').replace(/```\s*$/,'').trim());
}

function plannerPrompt(key){
  const p=NICHES[key]; const format=els.format.value==='long'?'3–5 minute 16:9 explainer':'45–60 second 9:16 YouTube Short'; const market=marketContext(); const goal=revenueGoalValue();
  return `You are the strategy, research, script, SEO and thumbnail team for a faceless YouTube channel.\nCreate one ORIGINAL advertiser-friendly ${format} in the niche: ${p.label}.\nThe goal is useful, evergreen educational content with commercially valuable search intent.
Target audience markets: ${market.countries.join(', ')}. Prefer topics, terminology and examples that are naturally relevant to these markets without stuffing country names into titles or descriptions.
Internal planning goal: build toward ${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(goal)} per month. Never state or imply that this income is guaranteed, and do not mention the revenue goal in viewer-facing content.
Do not promise a CPM/RPM, income, ranking, legal result, investment result, insurance approval, mortgage approval or guaranteed outcome. Do not give personalized financial or legal advice. Avoid current rates, prices, laws, statistics or product claims unless you explicitly flag them for verification.\nUse clear international English suitable for viewers in the US, Canada, UK, Australia and New Zealand.\nReturn strict JSON only with keys: topic, searchIntent, audience, chosenTitle, titleCandidates (array of 5), hook, script, description, tags (array 10-15), hashtags (array 3-5), thumbnailTexts (array 4, each 2-4 words), verificationQueries (array), riskNotes (array).\nTitle should be accurate and normally 35-70 characters. Description should summarize the value immediately and naturally include the topic. Script needs a strong first-two-second hook, frequent progression, one generic example, a concise CTA, and this disclaimer: ${p.disclaimer}`;
}

function normalizePlan(raw,key){
  const fallback=localPlan(key); const p=NICHES[key];
  const arr=(v,max)=>Array.isArray(v)?v.map(clean).filter(Boolean).slice(0,max):[];
  let description=clean(raw.description)||fallback.description;
  if(!description.toLowerCase().includes(p.disclaimer.toLowerCase().slice(0,20))) description+=`\n\n${p.disclaimer}`;
  const topic=clean(raw.topic)||fallback.topic; rememberTopic(topic);
  const titleCandidates=arr(raw.titleCandidates,5); const tags=arr(raw.tags,15); const thumbs=arr(raw.thumbnailTexts,4).map(x=>x.split(/\s+/).slice(0,4).join(' ').toUpperCase());
  const hashes=arr(raw.hashtags,5).map(x=>x.startsWith('#')?x:`#${x.replace(/[^a-z0-9]/gi,'')}`).filter(x=>x.length>1);
  return {
    niche:key,nicheLabel:p.label,valueLabel:p.valueLabel,categoryId:p.categoryId,format:els.format.value,topic,
    searchIntent:clean(raw.searchIntent)||fallback.searchIntent,audience:clean(raw.audience)||fallback.audience,
    chosenTitle:(clean(raw.chosenTitle)||titleCandidates[0]||fallback.chosenTitle).slice(0,100),titleCandidates:titleCandidates.length?titleCandidates:fallback.titleCandidates,
    hook:clean(raw.hook)||fallback.hook,script:clean(raw.script)||fallback.script,description:description.slice(0,5000),
    tags:tags.length?tags:fallback.tags,hashtags:hashes.length?hashes:fallback.hashtags,thumbnailTexts:thumbs.length?thumbs:fallback.thumbnailTexts,
    verificationQueries:arr(raw.verificationQueries,8),riskNotes:arr(raw.riskNotes,8),disclaimer:p.disclaimer,source:'gemini'
  };
}

function seoScore(plan){
  if(!plan)return 0; const title=clean(plan.chosenTitle); const desc=String(plan.description||''); const tags=plan.tags||[]; const hashes=plan.hashtags||[]; const thumb=clean(plan.thumbnailTexts?.[0]||'');
  let s=0;
  if(title.length>=32&&title.length<=72)s+=20; else if(title.length>=20&&title.length<=85)s+=12;
  const topicWords=clean(plan.topic).toLowerCase().split(/\s+/).filter(w=>w.length>4).slice(0,3);
  if(topicWords.some(w=>title.toLowerCase().includes(w)))s+=15;
  if(desc.length>=150&&desc.length<=2000)s+=15;
  if(topicWords.some(w=>desc.toLowerCase().includes(w)))s+=10;
  if(tags.length>=8&&tags.length<=15)s+=15;
  if(hashes.length>=3&&hashes.length<=5)s+=10;
  if(thumb&&thumb.split(/\s+/).length<=4)s+=10;
  if(desc.toLowerCase().includes(plan.disclaimer.toLowerCase().slice(0,18)))s+=5;
  return Math.min(100,s);
}

function qualityItems(plan){
  const items=[
    ['✓',`${plan.nicheLabel}: ${plan.valueLabel}`],
    ['✓','Evergreen educational angle; no earnings/ranking promise'],
    ['✓','Original script + original motion graphics by default'],
    ['✓',`${plan.titleCandidates.length} title variants + ${plan.thumbnailTexts.length} thumbnail messages`],
    ['✓',`${plan.tags.length} keyword tags + ${plan.hashtags.length} hashtags`],
    ['!',plan.disclaimer]
  ];
  for(const x of plan.verificationQueries||[])items.push(['!',x]);
  return items;
}

function renderPlan(plan){
  state.plan=plan;
  els.topic.value=plan.topic; els.title.value=plan.chosenTitle; els.description.value=plan.description; els.tags.value=plan.tags.join(', '); els.hashtags.value=plan.hashtags.join(' '); els.thumbText.value=plan.thumbnailTexts[0]||''; els.script.value=plan.script;
  els.variants.innerHTML=plan.titleCandidates.map((x,i)=>`<button type="button" class="title-variant" data-idx="${i}">${esc(x)}</button>`).join('');
  els.variants.querySelectorAll('[data-idx]').forEach(b=>b.addEventListener('click',()=>{plan.chosenTitle=plan.titleCandidates[Number(b.dataset.idx)];els.title.value=plan.chosenTitle;renderScore();}));
  els.quality.innerHTML=qualityItems(plan).map(([icon,text])=>`<div class="check-item"><strong>${icon}</strong><span>${esc(text)}</span></div>`).join('');
  els.createVideo.disabled=false; renderScore(); renderIdeas(); updatePublishGuard();
}

function pullEditsIntoPlan(){
  if(!state.plan)return;
  state.plan.topic=clean(els.topic.value)||state.plan.topic; state.plan.chosenTitle=clean(els.title.value)||state.plan.chosenTitle; state.plan.description=els.description.value.trim(); state.plan.tags=els.tags.value.split(',').map(clean).filter(Boolean).slice(0,15); state.plan.hashtags=els.hashtags.value.split(/\s+/).map(clean).filter(Boolean).slice(0,5); state.plan.thumbnailTexts[0]=clean(els.thumbText.value)||state.plan.thumbnailTexts[0]; state.plan.script=els.script.value.trim()||state.plan.script;
}
function renderScore(){ pullEditsIntoPlan(); const n=seoScore(state.plan); els.score.innerHTML=`<strong>${n}/100</strong><span>SEO readiness</span>`; updatePublishGuard(); }

async function generatePlan(){
  const key=pickNiche(), profile=NICHES[key]; resetAgents(); setAgent('strategy','Working','working'); setAgent('research','Working','working'); setStatus(`Building a ${profile.label} content plan…`); els.generate.disabled=true; setProgress(5);
  try{
    let plan; const apiKey=state.settings.geminiKey;
    if(apiKey){
      try{ const raw=await geminiJson(plannerPrompt(key),apiKey,state.settings.geminiTextModel||'gemini-3.7-flash'); plan=normalizePlan(raw,key); setAgent('research','AI plan ready','good'); }
      catch(err){ console.warn(err); plan=localPlan(key); setAgent('research','Local fallback','warn'); setStatus(`Gemini was unavailable, so the $0 local planner took over: ${err.message||err}`,'subtle'); }
    } else { plan=localPlan(key); setAgent('research','$0 local plan','good'); }
    setProgress(45); setAgent('strategy','Ready','good'); setAgent('script','Ready','good'); setAgent('seo','Ready','good'); setAgent('thumbnail','Ready','good'); renderPlan(plan); setProgress(55); setStatus(`Plan ready: ${plan.topic}`,'good'); return plan;
  } finally { els.generate.disabled=false; }
}

function splitSentences(text){ return clean(text).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean); }
function sceneTexts(plan){
  const sentences=splitSentences(plan.script); const target=plan.format==='long'?Math.min(14,Math.max(8,Math.ceil(sentences.length/2))):Math.min(8,Math.max(5,sentences.length));
  const groups=Array.from({length:target},()=>[]); sentences.forEach((s,i)=>groups[i%target].push(s));
  return groups.map(x=>x.join(' ')).filter(Boolean);
}
function wrapCanvasText(ctx,text,maxWidth,maxLines=5){
  const words=clean(text).split(/\s+/).filter(Boolean),lines=[];let line='';
  for(const word of words){const t=line?`${line} ${word}`:word;if(ctx.measureText(t).width<=maxWidth)line=t;else{if(line)lines.push(line);line=word;if(lines.length>=maxLines-1)break;}}
  if(line&&lines.length<maxLines)lines.push(line); return lines;
}
async function makeScenePng(text,index,total,plan){
  const vertical=plan.format!=='long'; const c=document.createElement('canvas');
  // Phones render lighter scene frames to avoid browser memory pressure, then FFmpeg
  // scales the final export to Full HD 1080p. Desktop keeps native Full-HD source frames.
  const source=renderSourceSize(plan);c.width=source.w;c.height=source.h; const ctx=c.getContext('2d'); const w=c.width,h=c.height;
  const scale=w/(vertical?720:1280);
  const hue=(220+index*27+(plan.niche.charCodeAt(0)%30))%360; const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,`hsl(${hue} 58% 17%)`);g.addColorStop(1,`hsl(${(hue+58)%360} 72% 7%)`);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=.18;for(let i=0;i<8;i++){ctx.beginPath();ctx.arc((w/7)*(i%7),h*(.12+((i+index)%4)*.23),(80+i*16)*scale,0,Math.PI*2);ctx.fillStyle=`hsl(${(hue+i*14)%360} 80% 58%)`;ctx.fill();}ctx.globalAlpha=1;
  const pad=(vertical?52:72)*scale;ctx.fillStyle='rgba(255,255,255,.11)';ctx.fillRect(pad,pad,w-pad*2,7*scale);ctx.font=`800 ${(vertical?23:22)*scale}px Arial`;ctx.fillStyle='rgba(255,255,255,.78)';ctx.fillText(plan.nicheLabel.toUpperCase(),pad,pad+46*scale);
  const headline=index===0?plan.hook:text;ctx.font=`900 ${(vertical?52:56)*scale}px Arial`;ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.85)';ctx.lineWidth=8*scale;ctx.lineJoin='round';const lines=wrapCanvasText(ctx,headline,w-pad*2,vertical?7:5);let y=(vertical?310:220)*scale;const lh=(vertical?64:68)*scale;for(const line of lines){ctx.strokeText(line,pad,y,w-pad*2);ctx.fillText(line,pad,y,w-pad*2);y+=lh;}
  ctx.font=`700 ${(vertical?21:19)*scale}px Arial`;ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText(`ORIGINAL EXPLAINER • ${index+1}/${total}`,pad,h-pad-24*scale);
  return await new Promise(resolve=>c.toBlob(resolve,mobileSafeRender()?'image/jpeg':'image/png',mobileSafeRender()?.88:undefined));
}

function b64Bytes(s){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function pcmWav(pcm,sampleRate=24000){
  const b=new ArrayBuffer(44+pcm.length),v=new DataView(b),u=new Uint8Array(b);const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};ws(0,'RIFF');v.setUint32(4,36+pcm.length,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,pcm.length,true);u.set(pcm,44);return new Blob([b],{type:'audio/wav'});
}
async function geminiTts(text){
  if(!state.settings.geminiKey)return null; const model=state.settings.geminiTtsModel||'gemini-3.1-flash-tts-preview'; const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(state.settings.geminiKey)}`;
  const response=await fetchWithTimeout(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:els.voice.value||'Kore'}}}}})},90000);
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data?.error?.message||`Gemini TTS failed (${response.status}).`); const part=data?.candidates?.[0]?.content?.parts?.find(p=>p?.inlineData?.data);if(!part)throw new Error('Gemini TTS returned no audio.');return pcmWav(b64Bytes(part.inlineData.data),24000);
}
function localVoiceName(){
  const v=els.voice?.value||'Kore';
  return ({Kore:'af_heart',Puck:'am_puck',Charon:'am_michael',Aoede:'af_aoede',Leda:'bf_emma'})[v]||'af_heart';
}
function splitForLocalTts(text,maxChars=mobileSafeRender()?180:260){
  const sentences=clean(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks=[]; let current='';
  for(const sentence of sentences){
    if((current+' '+sentence).trim().length<=maxChars){current=(current+' '+sentence).trim();continue;}
    if(current)chunks.push(current);
    if(sentence.length<=maxChars){current=sentence;continue;}
    const words=sentence.split(/\s+/);current='';
    for(const word of words){
      if((current+' '+word).trim().length>maxChars){if(current)chunks.push(current);current=word;}
      else current=(current+' '+word).trim();
    }
  }
  if(current)chunks.push(current);
  return chunks.length?chunks:[clean(text)];
}
function floatSamplesToWav(samples,sampleRate=24000){
  const dataBytes=samples.length*2;
  const b=new ArrayBuffer(44+dataBytes),v=new DataView(b),u=new Uint8Array(b);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF');v.setUint32(4,36+dataBytes,true);ws(8,'WAVE');ws(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);
  v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,dataBytes,true);
  let o=44;
  for(let i=0;i<samples.length;i++,o+=2){const s=Math.max(-1,Math.min(1,Number(samples[i])||0));v.setInt16(o,s<0?s*0x8000:s*0x7fff,true);}
  return new Blob([u],{type:'audio/wav'});
}
async function mobileWorkerTts(text){
  if(!window.Worker)throw new Error('This browser does not support the background voice worker.');
  const workerUrl=new URL('./tts-worker.js',import.meta.url);
  return await new Promise((resolve,reject)=>{
    const worker=new Worker(workerUrl,{type:'module'});
    let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);try{worker.terminate();}catch{}fn(value);};
    const timer=setTimeout(()=>finish(reject,new Error('Free local narration took too long and was stopped to protect the browser from freezing.')),TTS_WORKER_TIMEOUT_MS);
    worker.onerror=(e)=>finish(reject,new Error(e?.message||'The background narration worker failed.'));
    worker.onmessage=(e)=>{
      const m=e.data||{};
      if(m.type==='load'){setStatus(`Loading free local AI voice in background… ${Math.max(0,Math.min(100,Math.round(Number(m.progress)||0)))}%`);return;}
      if(m.type==='chunk'){setStatus(`Generating narration in background… ${m.index}/${m.total}`);return;}
      if(m.type==='error'){finish(reject,new Error(m.message||'Background narration failed.'));return;}
      if(m.type==='done'){
        const buf=m.buffer;
        if(!(buf instanceof ArrayBuffer)||buf.byteLength<45){finish(reject,new Error('Background narration returned invalid audio.'));return;}
        finish(resolve,new Blob([buf],{type:'audio/wav'}));
      }
    };
    worker.postMessage({type:'generate',text:clean(text),voice:localVoiceName(),maxChars:220});
  });
}

async function localKokoroTts(text){
  if(mobileSafeRender()){
    setStatus('Starting the free local AI voice in a background worker…');
    return mobileWorkerTts(text);
  }
  setStatus('Loading the free local AI voice…');
  if(!state.kokoro){
    const mod=await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    state.kokoro=await mod.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX',{
      dtype:'q4',
      device:'wasm',
      progress_callback:p=>{
        if(p?.progress!=null){
          const pct=Math.max(0,Math.min(100,Math.round(Number(p.progress)||0)));
          setStatus('Loading free local AI voice… '+pct+'%');
        }
      }
    });
  }
  const pieces=splitForLocalTts(text,260);
  const chunks=[]; let sampleRate=24000; let total=0;
  for(let i=0;i<pieces.length;i++){
    setStatus(`Generating free local narration… ${i+1}/${pieces.length}`);
    const raw=await state.kokoro.generate(pieces[i],{voice:localVoiceName(),speed:1});
    const data=raw?.data||raw?.audio;
    if(!(data instanceof Float32Array)||!data.length)throw new Error('Local AI voice returned no audio samples.');
    sampleRate=Number(raw?.sampling_rate||raw?.samplingRate||sampleRate)||24000;
    chunks.push(data);total+=data.length;
  }
  const joined=new Float32Array(total);let offset=0;
  for(const x of chunks){joined.set(x,offset);offset+=x.length;}
  return floatSamplesToWav(joined,sampleRate);
}

async function mediaDuration(blob,kind='audio'){
  return await new Promise(resolve=>{const el=document.createElement(kind);const url=URL.createObjectURL(blob);el.preload='metadata';el.onloadedmetadata=()=>{const d=Number(el.duration||0);URL.revokeObjectURL(url);resolve(Number.isFinite(d)&&d>0?d:0);};el.onerror=()=>{URL.revokeObjectURL(url);resolve(0);};el.src=url;});
}
async function ensureFfmpeg(){
  if(state.ffmpeg?.loaded)return state.ffmpeg;
  setStatus('Loading the free local video renderer…');
  const ff=new FFmpeg();
  const base='https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  const classWorkerURL=new URL('./ffmpeg-worker.js',window.location.href).href;
  try{
    const [coreURL,wasmURL]=await Promise.all([
      toBlobURL(`${base}/ffmpeg-core.js`,'text/javascript'),
      toBlobURL(`${base}/ffmpeg-core.wasm`,'application/wasm')
    ]);
    await withTimeout(ff.load({coreURL,wasmURL,classWorkerURL}),FFMPEG_LOAD_TIMEOUT_MS,'Video renderer loading');
    state.ffmpeg=ff;
    return ff;
  }catch(err){
    try{ff.terminate?.();}catch{}
    state.ffmpeg=null;
    throw err;
  }
}
function srtTime(seconds){const ms=Math.max(0,Math.round(seconds*1000)),h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000),x=ms%1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(x).padStart(3,'0')}`;}
function makeSrt(lines,totalSeconds){const chunk=totalSeconds/Math.max(1,lines.length);return lines.map((t,i)=>`${i+1}\n${srtTime(i*chunk)} --> ${srtTime(Math.min(totalSeconds,(i+1)*chunk))}\n${clean(t)}\n`).join('\n');}
async function makeThumbnail(plan,sceneBlob){
  const bitmap=await createImageBitmap(sceneBlob);const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');const sr=bitmap.width/bitmap.height,tr=1280/720;let sx=0,sy=0,sw=bitmap.width,sh=bitmap.height;if(sr>tr){sw=bitmap.height*tr;sx=(bitmap.width-sw)/2;}else{sh=bitmap.width/tr;sy=(bitmap.height-sh)/2;}ctx.filter='brightness(1.14) contrast(1.18) saturate(1.16)';ctx.drawImage(bitmap,sx,sy,sw,sh,0,0,1280,720);ctx.filter='none';const g=ctx.createLinearGradient(0,280,0,720);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.9)');ctx.fillStyle=g;ctx.fillRect(0,250,1280,470);ctx.font='800 28px Arial';ctx.fillStyle='#fff';ctx.fillText(plan.nicheLabel.toUpperCase(),76,430);ctx.font='900 92px Arial';ctx.strokeStyle='rgba(0,0,0,.96)';ctx.lineWidth=14;ctx.lineJoin='round';ctx.fillStyle='#fff';const headline=clean(plan.thumbnailTexts[0]||plan.chosenTitle).split(/\s+/).slice(0,4).join(' ').toUpperCase();const lines=wrapCanvasText(ctx,headline,1120,2);let y=565;for(const line of lines){ctx.strokeText(line,76,y,1120);ctx.fillText(line,76,y,1120);y+=105;}ctx.fillStyle='#ffd45b';ctx.fillRect(78,686,280,9);bitmap.close?.();return await new Promise(r=>c.toBlob(r,'image/jpeg',.94));
}

async function renderVideo(){
  pullEditsIntoPlan();
  if(!state.plan)throw new Error('Generate a content plan first.');
  const plan=state.plan,scenes=sceneTexts(plan),mobile=mobileSafeRender(),finalSize=finalVideoSize(plan);
  await keepScreenAwake();
  setAgent('production','Preparing narration','working');setProgress(58);

  // IMPORTANT: make narration before loading FFmpeg. Loading the FFmpeg WASM runtime
  // and the local Kokoro voice model at the same time can exhaust memory on phones.
  let audio=null,audioSeconds=0,usedLocalVoice=false;
  if(state.settings.geminiKey){
    try{setStatus('Generating narration with Gemini…');audio=await geminiTts(plan.script);audioSeconds=await mediaDuration(audio,'audio');}
    catch(err){console.warn('Gemini narration failed; switching to free local voice.',err);setStatus('Gemini narration unavailable — switching to the free local AI voice…','subtle');}
  }
  if(!audio){
    try{usedLocalVoice=true;audio=await localKokoroTts(plan.script);audioSeconds=await mediaDuration(audio,'audio');}
    catch(err){console.error('Local narration failed',err);setAgent('production','Voice failed','warn');throw new Error(`I stopped instead of making another silent video. Free local narration could not finish on this device: ${err.message||err}`);}
  }
  if(!(audioSeconds>1))throw new Error('Narration was generated but its duration could not be verified, so the silent export was blocked.');

  setAgent('production',mobile?'Mobile-safe 1080p render':'1080p render','working');
  setStatus(mobile?'Preparing mobile-safe Full HD render…':'Loading the Full HD video renderer…');
  const ff=await ensureFfmpeg();
  const total=audioSeconds,per=total/scenes.length;let firstScene=null;const sceneExt=mobile?'jpg':'png';

  try{
    for(let i=0;i<scenes.length;i++){
      setStatus(`Preparing scene ${i+1}/${scenes.length}${mobile?' · mobile-safe memory mode':''}…`);
      const png=await makeScenePng(scenes[i],i,scenes.length,plan);
      if(i===0)firstScene=png;
      await ff.writeFile(`scene_${i}.${sceneExt}`,await fetchFile(png));
      setProgress(62+Math.round((i/scenes.length)*15));
      // Give the browser a chance to paint/respond between large canvas operations.
      if(mobile)await sleep(35);
    }

    const list=[];
    for(let i=0;i<scenes.length;i++){list.push(`file 'scene_${i}.${sceneExt}'`);list.push(`duration ${per.toFixed(3)}`);}
    list.push(`file 'scene_${scenes.length-1}.${sceneExt}'`);
    await ff.writeFile('scenes.txt',new TextEncoder().encode(list.join('\n')));
    for(const n of ['final.mp4','narration.wav']){try{await ff.deleteFile(n);}catch{}}

    const args=['-f','concat','-safe','0','-i','scenes.txt'];
    await ff.writeFile('narration.wav',await fetchFile(audio));args.push('-i','narration.wav');

    const filters=[];
    // Mobile source frames are intentionally smaller to prevent freezes, but the exported
    // MP4 is still 1080x1920 or 1920x1080.
    if(mobile)filters.push(`scale=${finalSize.w}:${finalSize.h}:flags=fast_bilinear`);
    filters.push('fps=24','format=yuv420p');

    if(turboEnabled()){
      args.push('-vf',filters.join(','),'-c:v','libx264','-preset',mobile?'ultrafast':'veryfast','-tune','stillimage','-crf',mobile?'28':'27','-maxrate',mobile?'3500k':'4000k','-bufsize',mobile?'7000k':'8000k');
      args.push('-c:a','aac','-b:a','128k','-af','volume=1.35','-shortest');
    }else{
      args.push('-vf',filters.join(','),'-c:v','libx264','-preset',mobile?'ultrafast':'veryfast','-crf',mobile?'24':'22','-maxrate',mobile?'6000k':'8000k','-bufsize',mobile?'12000k':'16000k');
      args.push('-c:a','aac','-b:a','160k','-af','volume=1.35','-shortest');
    }
    if(mobile)args.push('-threads','1');
    args.push('-movflags','+faststart','final.mp4');

    setStatus(mobile?'Encoding Full HD 1080p in mobile-safe mode…':'Encoding the Full HD 1080p MP4…');
    await sleep(mobile?80:0);
    const exitCode=await ff.exec(args,mobile?FFMPEG_EXEC_TIMEOUT_MS:FFMPEG_EXEC_TIMEOUT_MS+60000);
    if(Number(exitCode)!==0)throw new Error(`Video encoder stopped with code ${exitCode}.`);
    const data=await ff.readFile('final.mp4');
    state.videoBlob=new Blob([data.buffer],{type:'video/mp4'});
    state.videoFile=new File([state.videoBlob],`${slug(plan.chosenTitle)}.mp4`,{type:'video/mp4'});
    state.thumbnailBlob=await makeThumbnail(plan,firstScene);
    state.srt=makeSrt(scenes,total);
    setProgress(100);
    setAgent('production',`1080p narrated MP4 ready · ${mb(state.videoBlob.size)} MB`,'good');
    setAgent('publishing','Ready to preview','good');
    showPreview();
    setStatus(`Video ready — Full HD 1080p · ${mb(state.videoBlob.size)} MB${mobile?' · MOBILE-SAFE':''}${turboEnabled()?' · TURBO UPLOAD':''}.`,'good');
    updatePublishGuard();
    return state.videoFile;
  } finally {
    // Free the in-browser FFmpeg filesystem and WASM heap aggressively on phones.
    for(let i=0;i<scenes.length;i++){try{await ff.deleteFile(`scene_${i}.${sceneExt}`);}catch{}}
    for(const n of ['scenes.txt','narration.wav','final.mp4']){try{await ff.deleteFile(n);}catch{}}
    if(mobile){try{ff.terminate?.();}catch{} state.ffmpeg=null;}
    await releaseWakeLock();
  }
}

function cleanupUrls(){for(const u of state.renderUrls)URL.revokeObjectURL(u);state.renderUrls=[];}
function showPreview(){cleanupUrls();const v=URL.createObjectURL(state.videoBlob),t=URL.createObjectURL(state.thumbnailBlob);state.renderUrls.push(v,t);els.preview.src=v;els.preview.classList.remove('hidden');els.previewEmpty.classList.add('hidden');els.downloadVideo.href=v;els.downloadVideo.download=state.videoFile.name;els.downloadVideo.classList.remove('hidden');els.downloadThumbnail.href=t;els.downloadThumbnail.download=`${slug(state.plan.chosenTitle)}-thumbnail.jpg`;els.downloadThumbnail.classList.remove('hidden');els.uploadButton.disabled=!isConnected();}

async function createCurrentVideo(){
  if(!state.plan)await generatePlan();if(!state.plan)return;els.createVideo.disabled=true;try{setStatus('Creating your original video. Keep this tab open…');await renderVideo();setStatus('Video ready. Preview it, then upload — or enable FULL AUTOPILOT for future runs.','good');if(els.fullAuto.checked)await autoPublishCurrent();}catch(err){console.error(err);setStatus(err.message||String(err),'bad');setAgent('production','Needs attention','warn');}finally{els.createVideo.disabled=false;await releaseWakeLock();}
}

async function runBatch(){
  const count=clamp(Number(els.batch.value)||1,1,4);els.runBatch.disabled=true;try{for(let i=0;i<count;i++){setStatus(`Batch ${i+1}/${count}: creating strategy…`);state.plan=null;await generatePlan();setStatus(`Batch ${i+1}/${count}: rendering video…`);await renderVideo();if(els.fullAuto.checked){await autoPublishCurrent();}else if(count>1){setStatus(`Batch paused after video ${i+1}. FULL AUTOPILOT is OFF, so each generated video needs preview before another one replaces it.`,'good');break;}}if(els.fullAuto.checked)setStatus(`Batch complete: ${count} video${count===1?'':'s'} processed.`,'good');}catch(err){console.error(err);setStatus(err.message||String(err),'bad');}finally{els.runBatch.disabled=false;await releaseWakeLock();}
}

function saveAi(){state.settings.geminiKey=els.geminiKey.value.trim();state.settings.geminiTextModel=els.geminiTextModel.value.trim()||'gemini-3.7-flash';state.settings.geminiTtsModel=els.geminiTtsModel.value.trim()||'gemini-3.1-flash-tts-preview';saveSettings();loadSettings();}
function saveYoutube(){const id=els.googleClientId.value.trim();if(id&&!id.endsWith('.apps.googleusercontent.com')){els.youtubeSetupStatus.className='notice bad';els.youtubeSetupStatus.textContent='That does not look like a Google OAuth Client ID. It should end in .apps.googleusercontent.com.';return;}state.settings.googleClientId=id;saveSettings();loadSettings();}

async function waitGoogle(timeout=10000){const start=Date.now();while(!window.google?.accounts?.oauth2){if(Date.now()-start>timeout)throw new Error('Google sign-in library did not load. Check the connection or content blockers, then refresh.');await sleep(150);}}
async function requestToken(){
  if(!state.settings.googleClientId)throw new Error('Add your Google OAuth Client ID in Setup first.');
  await waitGoogle();
  return await withTimeout(new Promise((resolve,reject)=>{
    const client=google.accounts.oauth2.initTokenClient({
      client_id:state.settings.googleClientId,
      scope:SCOPES,
      callback:r=>{
        if(r.error)return reject(new Error(r.error_description||r.error));
        state.accessToken=r.access_token;
        state.expiresAt=Date.now()+Math.max(60,Number(r.expires_in||3600)-60)*1000;
        resolve(r.access_token);
      },
      error_callback:e=>reject(new Error(e?.message||e?.type||'Google sign-in failed.'))
    });
    client.requestAccessToken({prompt:state.accessToken?'':'consent'});
  }),60000,'Google sign-in');
}
async function token(){if(state.accessToken&&Date.now()<state.expiresAt)return state.accessToken;return requestToken();}
function isConnected(){return Boolean(state.accessToken&&Date.now()<state.expiresAt);}
function ytUrl(path,params={}){const u=new URL(`https://www.googleapis.com/youtube/v3/${path}`);for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v));return u.toString();}
async function apiJson(url,options={}){const h=new Headers(options.headers||{});h.set('Authorization',`Bearer ${await token()}`);const r=await fetchWithTimeout(url,{...options,headers:h});const tx=await r.text();let d={};try{d=tx?JSON.parse(tx):{};}catch{d={raw:tx};}if(!r.ok)throw new Error(d?.error?.message||d?.raw||`${r.status} ${r.statusText}`);return d;}

function setConnectedUI(connected,title=''){
  els.connect.classList.toggle('hidden',connected);els.disconnect.classList.toggle('hidden',!connected);els.refreshAnalytics.disabled=!connected;els.uploadButton.disabled=!(connected&&state.videoBlob);
  if(connected){els.youtubeBanner.textContent=`✓ YouTube connected${title?` — ${title}`:''}`;els.youtubeBanner.style.background='#0e2419';els.youtubeBanner.style.color='#9aeabc';els.youtubeStatus.className='notice good';els.youtubeStatus.textContent=`Connected${title?` to ${title}`:''}.`;}else{els.youtubeBanner.textContent='● YouTube not connected';els.youtubeBanner.style.background='#141922';els.youtubeBanner.style.color='#c4cada';els.youtubeStatus.className='notice subtle';els.youtubeStatus.textContent='YouTube is not connected yet.';}updatePublishGuard();
}
async function connectYoutube(){
  els.connect.disabled=true;els.connect.textContent='Connecting…';try{await requestToken();resetPlaylistCache();await refreshChannel();setConnectedUI(true,state.channel?.snippet?.title||'your channel');await refreshAnalytics();}catch(err){console.error(err);setConnectedUI(false);els.youtubeStatus.className='notice bad';els.youtubeStatus.textContent=err.message||String(err);}finally{els.connect.disabled=false;els.connect.textContent='Connect YouTube';}
}
function disconnectYoutube(){const old=state.accessToken;state.accessToken='';state.expiresAt=0;state.channel=null;state.recentVideos=[];state.analytics=null;resetPlaylistCache();setConnectedUI(false);if(old&&window.google?.accounts?.oauth2?.revoke){try{google.accounts.oauth2.revoke(old,()=>{});}catch{}}}
async function refreshChannel(){const data=await apiJson(ytUrl('channels',{part:'snippet,contentDetails,statistics',mine:'true'}));state.channel=data.items?.[0]||null;if(!state.channel)throw new Error('No YouTube channel was returned for this Google account.');return state.channel;}

async function recentUploads(limit=12){
  if(!state.channel)await refreshChannel();const playlist=state.channel?.contentDetails?.relatedPlaylists?.uploads;if(!playlist)return[];const p=await apiJson(ytUrl('playlistItems',{part:'snippet,contentDetails',playlistId:playlist,maxResults:limit}));const ids=(p.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean);if(!ids.length)return[];const d=await apiJson(ytUrl('videos',{part:'snippet,statistics,contentDetails',id:ids.join(',')}));state.recentVideos=d.items||[];return state.recentVideos;
}
async function analytics28(){
  const end=new Date();const start=new Date(Date.now()-27*86400000);const u=new URL('https://youtubeanalytics.googleapis.com/v2/reports');u.searchParams.set('ids','channel==MINE');u.searchParams.set('startDate',dateYmd(start));u.searchParams.set('endDate',dateYmd(end));u.searchParams.set('metrics','views,estimatedMinutesWatched,subscribersGained,subscribersLost');const r=await fetchWithTimeout(u,{headers:{Authorization:`Bearer ${await token()}`}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message||'YouTube Analytics request failed.');const row=data.rows?.[0]||[0,0,0,0];state.analytics={views:Number(row[0]||0),minutes:Number(row[1]||0),gained:Number(row[2]||0),lost:Number(row[3]||0)};return state.analytics;
}
async function refreshAnalytics(){
  els.refreshAnalytics.disabled=true;setAgent('analytics','Loading real data','working');try{if(!state.channel)await refreshChannel();const [videos,analytics]=await Promise.all([recentUploads(),analytics28().catch(err=>{console.warn(err);return null;})]);els.metricChannel.textContent=state.channel.snippet?.title||'—';if(analytics){els.metricViews.textContent=formatNumber(analytics.views);els.metricWatch.textContent=formatNumber((analytics.minutes/60).toFixed(1));els.metricSubs.textContent=formatNumber(analytics.gained-analytics.lost);}renderRecent(videos);renderIdeas();setAgent('analytics','Real data loaded','good');}catch(err){console.error(err);els.recentVideos.className='list-body';els.recentVideos.innerHTML=`<div class="notice bad">${esc(err.message||String(err))}</div>`;setAgent('analytics','Needs attention','warn');}finally{els.refreshAnalytics.disabled=!isConnected();}
}
function renderRecent(videos=[]){
  els.recentVideos.className='list-body';if(!videos.length){els.recentVideos.innerHTML='<span class="muted">No recent videos loaded.</span>';return;}els.recentVideos.innerHTML=`<div class="video-list">${videos.slice(0,10).map(v=>`<div class="video-row"><strong>${esc(v.snippet?.title||'Untitled')}</strong><small>${formatNumber(v.statistics?.viewCount||0)} views • ${new Date(v.snippet?.publishedAt||Date.now()).toLocaleDateString()}</small></div>`).join('')}</div>`;
}
function renderIdeas(){
  const base=state.plan?[state.plan.topic,...NICHES[state.plan.niche].topics.filter(t=>t!==state.plan.topic).slice(0,3)]:AUTO_ORDER.slice(0,4).map(k=>NICHES[k].topics[0]);let context='High-value evergreen library';
  if(state.recentVideos.length){const words=new Map();for(const v of state.recentVideos){for(const w of clean(v.snippet?.title).toLowerCase().match(/[a-z]{5,}/g)||[]){if(!['about','explained','video','shorts','these','their'].includes(w))words.set(w,(words.get(w)||0)+1);}}const top=[...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);if(top.length)context=`Recent channel themes: ${top.join(', ')}`;}
  els.nextIdeas.className='list-body';els.nextIdeas.innerHTML=`<div class="idea-list"><div class="idea-row"><strong>Feedback context</strong><small>${esc(context)}</small></div>${base.slice(0,4).map((t,i)=>`<div class="idea-row"><strong>${i+1}. ${esc(t)}</strong><small>Keep the angle original and verify any current facts before publishing.</small></div>`).join('')}</div>`;
}

function multipart(metadata,media,mediaType,boundary){return new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(metadata),`\r\n--${boundary}\r\nContent-Type: ${mediaType}\r\n\r\n`,media,`\r\n--${boundary}--\r\n`],{type:`multipart/related; boundary=${boundary}`});}
function xhrUpload(url,body,auth,onProgress){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();
    x.open('POST',url,true);
    x.timeout=15*60*1000;
    x.setRequestHeader('Authorization',`Bearer ${auth}`);
    x.setRequestHeader('Content-Type',body.type);
    x.upload.onprogress=e=>{if(e.lengthComputable)onProgress?.(e.loaded/e.total);};
    x.onload=()=>{
      let d={};try{d=JSON.parse(x.responseText||'{}');}catch{d={raw:x.responseText};}
      if(x.status>=200&&x.status<300)resolve(d);else reject(new Error(d?.error?.message||d?.raw||`${x.status} ${x.statusText}`));
    };
    x.onerror=()=>reject(new Error('Network error during YouTube upload.'));
    x.ontimeout=()=>reject(new Error('YouTube upload timed out. Your generated video is still in the preview, so you can retry.'));
    x.onabort=()=>reject(new Error('YouTube upload was stopped.'));
    x.send(body);
  });
}
async function uploadThumbnail(videoId){if(!state.thumbnailBlob)return;const u=new URL('https://www.googleapis.com/upload/youtube/v3/thumbnails/set');u.searchParams.set('videoId',videoId);const r=await fetchWithTimeout(u,{method:'POST',headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'image/jpeg'},body:state.thumbnailBlob},90000);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||'Thumbnail upload failed.');}
async function uploadCaption(videoId){if(!state.srt)return;const meta={snippet:{videoId,language:'en',name:'ClipFree AI captions',isDraft:false}};const b=`cap_${Date.now()}`;const body=multipart(meta,new Blob([state.srt],{type:'application/x-subrip'}),'application/x-subrip',b);const u=new URL('https://www.googleapis.com/upload/youtube/v3/captions');u.searchParams.set('uploadType','multipart');u.searchParams.set('part','snippet');const r=await fetchWithTimeout(u,{method:'POST',headers:{Authorization:`Bearer ${await token()}`,'Content-Type':body.type},body},90000);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||'Caption upload failed.');}
async function loadPlaylistCache(){
  if(state.playlistCacheLoaded)return;
  state.playlistCache.clear();
  let pageToken='';
  do{
    const p=await apiJson(ytUrl('playlists',{part:'snippet,status',mine:'true',maxResults:50,pageToken}));
    for(const item of p.items||[]){
      const key=clean(item.snippet?.title).toLowerCase();
      if(key&&item.id)state.playlistCache.set(key,item.id);
    }
    pageToken=p.nextPageToken||'';
  }while(pageToken);
  state.playlistCacheLoaded=true;
}
async function ensurePlaylist(name,description='Educational explainers created and published with ClipFree AI.'){
  const safe=clean(name);if(!safe)return'';await loadPlaylistCache();const key=safe.toLowerCase();if(state.playlistCache.has(key))return state.playlistCache.get(key);const d=await apiJson(ytUrl('playlists',{part:'snippet,status'}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snippet:{title:safe,description:clean(description).slice(0,5000)},status:{privacyStatus:'public'}})});if(d.id)state.playlistCache.set(key,d.id);return d.id||'';
}
function autoPlaylistSpecs(plan=state.plan){
  const specs=[];if(plan?.niche&&AUTO_PLAYLISTS[plan.niche])specs.push(AUTO_PLAYLISTS[plan.niche]);
  const formatKey=plan?.format==='long'?'long':'short';if(FORMAT_PLAYLISTS[formatKey])specs.push(FORMAT_PLAYLISTS[formatKey]);
  return specs;
}
async function ensureAllAutomaticPlaylists(){
  if(!isConnected())await requestToken();
  const specs=[...Object.values(AUTO_PLAYLISTS),...Object.values(FORMAT_PLAYLISTS)];
  const made=[];
  for(let i=0;i<specs.length;i++){
    if(els.playlistStatus)els.playlistStatus.textContent=`Creating/checking playlist ${i+1}/${specs.length}: ${specs[i].title}`;
    const id=await ensurePlaylist(specs[i].title,specs[i].description);made.push({id,...specs[i]});
  }
  if(els.playlistStatus){els.playlistStatus.className='notice good';els.playlistStatus.textContent=`Automatic playlists ready: ${made.map(x=>x.title).join(', ')}.`;}
  return made;
}
async function addPlaylist(videoId,playlistId){if(!playlistId)return;await apiJson(ytUrl('playlistItems',{part:'snippet'}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snippet:{playlistId,resourceId:{kind:'youtube#video',videoId}}})});}
async function uploadYoutube(){
  if(navigator.onLine===false)throw new Error('Your device is offline. Reconnect to the internet before uploading.');
  pullEditsIntoPlan();if(!state.videoBlob)throw new Error('Generate a video first.');if(!state.plan)throw new Error('No content package is ready.');if(!els.rights.checked)throw new Error('Confirm the factual / publishing review before uploading.');if(!isConnected())await requestToken();const title=clean(state.plan.chosenTitle);if(!title)throw new Error('A YouTube title is required.');
  await keepScreenAwake();
  els.uploadButton.disabled=true;els.uploadProgress.style.width='2%';setAgent('publishing','Uploading','working');
  try{
    const status={privacyStatus:els.privacy.value,selfDeclaredMadeForKids:els.madeForKids.value==='true'};const publishAt=els.schedule.value?new Date(els.schedule.value):null;if(publishAt&&Number.isFinite(publishAt.getTime())&&publishAt>Date.now()){status.privacyStatus='private';status.publishAt=publishAt.toISOString();}
    const metadata={snippet:{title:title.slice(0,100),description:state.plan.description.slice(0,5000),categoryId:state.plan.categoryId||'27',defaultLanguage:'en',tags:state.plan.tags.slice(0,15)},status};const boundary=`clipfree_${Date.now()}`;const body=multipart(metadata,state.videoBlob,'video/mp4',boundary);const u=new URL('https://www.googleapis.com/upload/youtube/v3/videos');u.searchParams.set('uploadType','multipart');u.searchParams.set('part','snippet,status');u.searchParams.set('notifySubscribers','false');
    const started=performance.now();let lastT=started,lastLoaded=0;
    els.uploadResult.textContent=`Uploading ${mb(state.videoBlob.size)} MB${turboEnabled()?' · TURBO':''}…`;
    const result=await xhrUpload(u.toString(),body,await token(),p=>{const now=performance.now();const loaded=p*body.size;const dt=(now-lastT)/1000;if(dt>.65){const rate=(loaded-lastLoaded)/Math.max(.01,dt);const remain=Math.max(0,body.size-loaded);const eta=rate>0?Math.ceil(remain/rate):0;const mbps=(rate*8/1e6).toFixed(1);els.uploadResult.textContent=`Uploading… ${Math.round(p*100)}% · ${mbps} Mbps${eta?` · ~${eta}s left`:''}`;lastT=now;lastLoaded=loaded;}els.uploadProgress.style.width=`${Math.round(2+p*90)}%`;});
    const uploadSeconds=((performance.now()-started)/1000).toFixed(1);
    if(result.id){
      // Run thumbnail, captions and playlist work together instead of waiting for each one in sequence.
      const jobs=[];
      if(els.uploadThumbnail.checked)jobs.push(uploadThumbnail(result.id));
      if(els.uploadCaptions.checked&&state.srt)jobs.push(uploadCaption(result.id));
      const playlistSpecs=els.autoPlaylist?.checked?autoPlaylistSpecs(state.plan):[];const manual=clean(els.playlistName?.value||'');if(manual)playlistSpecs.push({title:manual,description:'High Value Explained videos.'});const seen=new Set();
      for(const spec of playlistSpecs){if(!spec?.title||seen.has(spec.title.toLowerCase()))continue;seen.add(spec.title.toLowerCase());jobs.push((async()=>{const pid=await ensurePlaylist(spec.title,spec.description);if(pid)await addPlaylist(result.id,pid);})());}
      let extraFailures=0;
      if(jobs.length){
        els.uploadResult.textContent='Main video uploaded — finishing thumbnail, captions and playlists in parallel…';
        const extras=await Promise.allSettled(jobs);
        extraFailures=extras.filter(x=>x.status==='rejected').length;
        if(extraFailures)console.warn('Some post-upload tasks failed',extras.filter(x=>x.status==='rejected'));
      }
      result.extraFailures=extraFailures;
    }
    els.uploadProgress.style.width='100%';
    const extraFailures=Number(result.extraFailures||0);
    els.uploadResult.className=extraFailures?'notice subtle':'notice good';
    els.uploadResult.innerHTML=`Video upload complete in about ${uploadSeconds}s${extraFailures?` · ${extraFailures} extra task${extraFailures===1?'':'s'} need retrying`:''}${result.id?`. <a href="https://www.youtube.com/watch?v=${encodeURIComponent(result.id)}" target="_blank" rel="noopener">Open on YouTube</a>`:''}.`;
    setAgent('publishing',extraFailures?'Video uploaded · extras need attention':'Upload complete',extraFailures?'warn':'good');
    setTimeout(()=>refreshAnalytics().catch(()=>{}),1500);
    return result;
  } catch(err){
    els.uploadProgress.style.width='0%';els.uploadResult.className='notice bad';els.uploadResult.textContent=err.message||String(err);setAgent('publishing','Needs attention','warn');throw err;
  }finally{
    els.uploadButton.disabled=!(isConnected()&&state.videoBlob);
    await releaseWakeLock();
  }
}
async function autoPublishCurrent(){if(!els.rights.checked){setStatus('Video created, but FULL AUTOPILOT did not upload because the publishing confirmation is not checked.','good');return;}if(!isConnected()){setStatus('Video created. Connect YouTube before FULL AUTOPILOT can publish.','good');return;}await uploadYoutube();}

function updatePublishGuard(){
  const checks=[Boolean(state.videoBlob),Boolean(state.plan?.disclaimer),Boolean(state.plan&&seoScore(state.plan)>=70),Boolean(state.thumbnailBlob),Boolean(els.rights.checked),isConnected()];const labels=['Original generated visuals','Accurate educational framing','SEO package complete','Thumbnail ready','Rights / factual review confirmed','YouTube connected'];const rows=els.publishGuard.querySelectorAll('div');rows.forEach((r,i)=>{r.className=checks[i]?'ok':'';r.innerHTML=`<span>${checks[i]?'✓':'○'}</span> ${labels[i]}`;});
}

els.generate.addEventListener('click',()=>generatePlan().catch(err=>setStatus(err.message||String(err),'bad')));
els.createVideo.addEventListener('click',()=>createCurrentVideo());
els.runBatch.addEventListener('click',()=>runBatch());
els.saveAi.addEventListener('click',saveAi);els.saveYoutube.addEventListener('click',saveYoutube);els.connect.addEventListener('click',connectYoutube);els.disconnect.addEventListener('click',disconnectYoutube);els.refreshAnalytics.addEventListener('click',refreshAnalytics);els.uploadButton.addEventListener('click',()=>uploadYoutube().catch(err=>console.error(err)));
els.createPlaylists?.addEventListener('click',async()=>{els.createPlaylists.disabled=true;try{await ensureAllAutomaticPlaylists();}catch(err){if(els.playlistStatus){els.playlistStatus.className='notice bad';els.playlistStatus.textContent=err.message||String(err);}}finally{els.createPlaylists.disabled=false;}});
[els.topic,els.title,els.description,els.tags,els.hashtags,els.thumbText,els.script].forEach(el=>el.addEventListener('input',renderScore));els.rights.addEventListener('change',updatePublishGuard);
[els.market,els.revenueGoal].filter(Boolean).forEach(el=>el.addEventListener('change',()=>{state.settings.marketPreset=els.market?.value||'premium';state.settings.revenueGoal=revenueGoalValue();saveSettings();renderGrowthTargets();renderIdeas();}));
els.fastUpload?.addEventListener('change',()=>{state.settings.fastUpload=els.fastUpload.checked;saveSettings();});
window.addEventListener('beforeunload',()=>{
  cleanupUrls();
  try{state.ffmpeg?.terminate?.();}catch{}
  try{wakeLockSentinel?.release?.();}catch{}
});

loadSettings();resetAgents();setConnectedUI(false);renderGrowthTargets();renderIdeas();updatePublishGuard();
