// This opt-in WebLLM model is never automatically loaded by importing this file.
export const MOBILE_MODEL_ID="smollm2-360m-instruct-q4f16";
export const MOBILE_MODEL_REPO="https://huggingface.co/skillsafe-ai/smollm2-360m-instruct-q4f16";
export const MOBILE_MODEL_LIB=MOBILE_MODEL_REPO+"/resolve/main/lib/SmolLM2-360M-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm";
export function mobileModelAppConfig(){
 return {model_list:[{model:MOBILE_MODEL_REPO,model_id:MOBILE_MODEL_ID,model_lib:MOBILE_MODEL_LIB,
  overrides:{context_window_size:1024,prefill_chunk_size:128}}]};
}
export function mobileCompletionRequest(messages){
 if(!Array.isArray(messages))throw new TypeError("Expected chat messages");
 return {messages:messages.map(m=>({role:m.role,content:String(m.content||"")})),max_tokens:64,temperature:0.2,top_p:0.9,stream:false};
}
