// An iPhone's model cannot be inferred reliably from Safari's user agent.
// The 360M experiment stays default-deny and never remembers user consent.
export function isAppleMobile(userAgent="",platform="",maxTouchPoints=0) {
  return /iPhone|iPad|iPod/i.test(String(userAgent)) ||
    (platform==="MacIntel" && Number(maxTouchPoints)>1);
}
export function resolveAIChoice(choice,device={}) {
  if(choice==="mobile-enhanced") return {model:"enhanced",style:"normal",label:"Experimental larger AI (360M)"};
  // Never hide a large-model download behind a button that sounds like a small-model writing style.
  // Standalone iOS web apps can report unexpected user-agent/platform values.
  if(choice==="clear") return {model:"light",style:"clear",label:"Clear writing (small AI)"};
  return {model:"light",style:"normal",label:"Lightweight AI"};
}
export function checkModelSupport(model,device={},options={}) {
  if(model==="enhanced" && isAppleMobile(device.userAgent,device.platform,device.maxTouchPoints) && options.experimentalMobile!==true)
    return {allowed:false,message:"Larger AI requires explicit experimental consent on iPhone/iPad. Safari may crash. Your save is safe; export a backup first."};
  return {allowed:true,message:""};
}
// The mobile profile bounds GPU prefill and output. It cannot guarantee memory safety.
export function compactAIMessages(messages,experimentalMobile=false) {
  if(!experimentalMobile) return messages;
  if(!Array.isArray(messages)) throw new TypeError("Expected chat messages");
  return messages.map(m=>({...m,content:String(m.content||"").slice(0,m.role==="system"?900:1300)}));
}
export function narrationGenerationOptions(model,style,experimentalMobile=false) {
  if(model==="enhanced" && experimentalMobile) return {max_new_tokens:64,do_sample:false,repetition_penalty:1.12,return_full_text:false};
  if(style==="clear") return {max_new_tokens:75,do_sample:false,repetition_penalty:1.12,return_full_text:false};
  return {max_new_tokens:105,do_sample:true,temperature:0.45,top_p:0.85,repetition_penalty:1.16,return_full_text:false};
}
