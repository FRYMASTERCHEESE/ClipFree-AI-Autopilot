const MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
let tts=null;
let modelPromise=null;
let activeDevice='wasm';

function clean(value=''){return String(value||'').replace(/\s+/g,' ').trim();}
function progressPercent(p){
  if(p?.progress!=null)return Math.max(0,Math.min(100,Math.round(Number(p.progress)||0)));
  if(Number(p?.total)>0)return Math.max(0,Math.min(100,Math.round((Number(p.loaded||0)/Number(p.total))*100)));
  return 0;
}
function post(requestId,type,data={}){self.postMessage({requestId,type,...data});}

function splitText(text,maxChars=340){
  const sentences=clean(text).split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks=[];let current='';
  for(const sentence of sentences){
    if((current+' '+sentence).trim().length<=maxChars){current=(current+' '+sentence).trim();continue;}
    if(current)chunks.push(current);
    if(sentence.length<=maxChars){current=sentence;continue;}
    const words=sentence.split(/\s+/);current='';
    for(const word of words){
      const next=(current+' '+word).trim();
      if(next.length>maxChars){if(current)chunks.push(current);current=word;}
      else current=next;
    }
  }
  if(current)chunks.push(current);
  return chunks.length?chunks:[clean(text)];
}

function floatToInt16(data){
  const out=new Int16Array(data.length);
  for(let i=0;i<data.length;i++){
    const s=Math.max(-1,Math.min(1,Number(data[i])||0));
    out[i]=s<0?Math.round(s*0x8000):Math.round(s*0x7fff);
  }
  return out;
}

function wavFromChunks(chunks,sampleRate){
  const totalSamples=chunks.reduce((n,x)=>n+x.length,0);
  const dataBytes=totalSamples*2;
  const buffer=new ArrayBuffer(44+dataBytes);
  const view=new DataView(buffer);
  const writeString=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
  writeString(0,'RIFF');view.setUint32(4,36+dataBytes,true);writeString(8,'WAVE');writeString(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);writeString(36,'data');view.setUint32(40,dataBytes,true);
  let offset=44;
  for(const chunk of chunks){for(let i=0;i<chunk.length;i++,offset+=2)view.setInt16(offset,chunk[i],true);}
  return buffer;
}

async function loadModel(requestId,preferWebGPU=false){
  if(tts)return tts;
  if(modelPromise)return modelPromise;
  modelPromise=(async()=>{
    const heartbeat=setInterval(()=>post(requestId,'heartbeat',{stage:'model-load'}),25000);
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
      const canWebGPU=Boolean(preferWebGPU&&self.navigator?.gpu);
      if(canWebGPU){
        try{
        activeDevice='webgpu';
        post(requestId,'mode',{device:'webgpu'});
        tts=await mod.KokoroTTS.from_pretrained(MODEL,{
          dtype:'fp32',device:'webgpu',
          progress_callback:p=>post(requestId,'load',{progress:progressPercent(p),status:p?.status||''})
        });
          return tts;
        }catch(err){
          try{await tts?.dispose?.();}catch{}
          tts=null;activeDevice='wasm';
          post(requestId,'fallback',{message:'WebGPU voice setup was unavailable; using compatibility mode.'});
        }
      }
      activeDevice='wasm';
      post(requestId,'mode',{device:'wasm'});
      tts=await mod.KokoroTTS.from_pretrained(MODEL,{
        dtype:'q4',device:'wasm',
        progress_callback:p=>post(requestId,'load',{progress:progressPercent(p),status:p?.status||''})
      });
      return tts;
    } finally {clearInterval(heartbeat);}
  })();
  try{return await modelPromise;}
  finally{modelPromise=null;}
}

async function generate(requestId,msg){
  const text=clean(msg.text);
  if(!text)throw new Error('Narration text is empty.');
  const voice=clean(msg.voice)||'af_heart';
  const maxChars=Math.max(180,Math.min(480,Number(msg.maxChars)||340));
  const speed=Math.max(.85,Math.min(1.2,Number(msg.speed)||1.04));
  const model=await loadModel(requestId,Boolean(msg.preferWebGPU));
  const pieces=splitText(text,maxChars);
  const chunks=[];let sampleRate=24000;
  for(let i=0;i<pieces.length;i++){
    post(requestId,'chunk',{index:i+1,total:pieces.length,device:activeDevice});
    const heartbeat=setInterval(()=>post(requestId,'heartbeat',{stage:'generate',index:i+1,total:pieces.length}),25000);
    let raw;
    try{raw=await model.generate(pieces[i],{voice,speed});}
    finally{clearInterval(heartbeat);}
    const data=raw?.data||raw?.audio;
    if(!(data instanceof Float32Array)||!data.length)throw new Error('Local AI voice returned no audio samples.');
    sampleRate=Number(raw?.sampling_rate||raw?.samplingRate||sampleRate)||24000;
    chunks.push(floatToInt16(data));
    post(requestId,'heartbeat',{index:i+1,total:pieces.length});
  }
  const wav=wavFromChunks(chunks,sampleRate);
  self.postMessage({requestId,type:'done',buffer:wav,device:activeDevice},[wav]);
}

self.onmessage=async(e)=>{
  const msg=e.data||{};const requestId=msg.requestId||'';
  if(!requestId)return;
  try{
    if(msg.type==='init'){
      await loadModel(requestId,Boolean(msg.preferWebGPU));
      post(requestId,'ready',{device:activeDevice});
      return;
    }
    if(msg.type==='generate'){
      await generate(requestId,msg);
      return;
    }
  }catch(err){
    post(requestId,'error',{message:err?.message||String(err)});
  }
};
