// Use the official WebLLM prebuilt model and matching compiled library.
// This pure config helper does not start downloads or GPU initialization.
export const MOBILE_MODEL_ID="SmolLM2-360M-Instruct-q4f16_1-MLC";
export function mobileModelAppConfig(prebuiltAppConfig){
 const record=prebuiltAppConfig?.model_list?.find(x=>x.model_id===MOBILE_MODEL_ID);
 if(!record?.model||!record?.model_lib)throw new Error("Official WebLLM 360M model unavailable in this runtime");
 return {model_list:[{...record,overrides:{...record.overrides,context_window_size:1024,prefill_chunk_size:128}}]};
}
export function mobileCompletionRequest(messages){
 if(!Array.isArray(messages))throw new TypeError("Expected chat messages");
 return {messages:messages.map(m=>({role:m.role,content:String(m.content||"")})),
   max_tokens:64,temperature:0.2,top_p:0.9,stream:false};
}
