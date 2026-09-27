const MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';

function clean(value=''){return String(value||'').replace(/\s+/g,' ').trim();}

function splitText(text,maxChars=220){
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
  for(const chunk of chunks){
    for(let i=0;i<chunk.length;i++,offset+=2)view.setInt16(offset,chunk[i],true);
  }
  return buffer;
}

self.onmessage=async(e)=>{
  const msg=e.data||{};
  if(msg.type!=='generate')return;
  try{
    const text=clean(msg.text);
    if(!text)throw new Error('Narration text is empty.');
    const voice=clean(msg.voice)||'af_heart';
    const maxChars=Math.max(120,Math.min(320,Number(msg.maxChars)||220));
    const mod=await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    const tts=await mod.KokoroTTS.from_pretrained(MODEL,{
      dtype:'q4',
      device:'wasm',
      progress_callback:p=>{
        if(p?.progress!=null)self.postMessage({type:'load',progress:Number(p.progress)||0});
      }
    });
    const pieces=splitText(text,maxChars);
    const chunks=[];let sampleRate=24000;
    for(let i=0;i<pieces.length;i++){
      self.postMessage({type:'chunk',index:i+1,total:pieces.length});
      const raw=await tts.generate(pieces[i],{voice,speed:1});
      const data=raw?.data||raw?.audio;
      if(!(data instanceof Float32Array)||!data.length)throw new Error('Local AI voice returned no audio samples.');
      sampleRate=Number(raw?.sampling_rate||raw?.samplingRate||sampleRate)||24000;
      chunks.push(floatToInt16(data));
    }
    try{await tts.dispose?.();}catch{}
    const wav=wavFromChunks(chunks,sampleRate);
    self.postMessage({type:'done',buffer:wav},[wav]);
  }catch(err){
    self.postMessage({type:'error',message:err?.message||String(err)});
  }
};
