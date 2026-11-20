// Independent diagnostic marker; NEVER modify the schema-1 adventure save.
export const AI_ATTEMPT_KEY="unwritten-realms-360m-attempt-v1";
const empty=()=>({active:false,interruptions:0,phase:"none"});
export function readAttempt(storage){
 try{
  const r=JSON.parse(storage.getItem(AI_ATTEMPT_KEY)||"null");
  if(!r||typeof r!=="object")return empty();
  return {active:r.active===true,interruptions:Math.max(0,Math.min(10,Number(r.interruptions)||0)),phase:String(r.phase||"unknown").slice(0,120)};
 }catch{return empty();}
}
function save(storage,r){try{storage.setItem(AI_ATTEMPT_KEY,JSON.stringify(r))}catch{}return r;}
export function detectInterruptedAttempt(storage){
 const r=readAttempt(storage);
 if(!r.active)return {...r,wasInterrupted:false};
 const next={...r,active:false,interruptions:Math.min(10,r.interruptions+1)};
 save(storage,next);return {...next,wasInterrupted:true};
}
export function beginAttempt(storage,phase="initializing"){
 const r=readAttempt(storage);
 return save(storage,{...r,active:true,phase:String(phase).slice(0,120)});
}
export function updateAttempt(storage,phase){
 const r=readAttempt(storage);
 return r.active?save(storage,{...r,phase:String(phase).slice(0,120)}):r;
}
export function endAttempt(storage,success=false){
 const r=readAttempt(storage);
 return save(storage,{...r,active:false,interruptions:success?0:r.interruptions,phase:success?"completed":r.phase});
}
