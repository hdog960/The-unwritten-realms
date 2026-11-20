// All inference is local to this worker. Mobile 360M is opt-in, not crash-proof.
import {compactAIMessages,narrationGenerationOptions} from "./ai-safety.js";
import {MOBILE_MODEL_ID,mobileModelAppConfig,mobileCompletionRequest} from "./mobile-llm.js";
const MODELS=Object.freeze({light:"onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",enhanced:"onnx-community/SmolLM2-360M-Instruct-ONNX"});
let generator=null,mobileEngine=null,activeModel="light",experimentalMobile=false;
self.onmessage=async({data})=>{
  if(!data?.type)return;
  if(data.type==="init"){
    try {
      self.postMessage({type:"stage",message:"worker started; checking WebGPU",button:"Checking GPU…"});
      if(!self.navigator?.gpu)throw new Error("GPU-02: WebGPU unavailable inside dedicated Worker");
      activeModel=MODELS[data.model]?data.model:"light";
      experimentalMobile=activeModel==="enhanced" && data.mobileExperimental===true;
      // Check hardware support BEFORE importing Transformers.js or downloading weights.
      if(experimentalMobile){
        self.postMessage({type:"stage",message:"WebGPU found; checking shader-f16 adapter feature",button:"Checking adapter…"});
        const adapter=await self.navigator.gpu.requestAdapter();
        if(!adapter)throw new Error("GPU-03: No usable WebGPU adapter");
        if(!adapter.features?.has("shader-f16"))throw new Error("GPU-04: Adapter lacks required shader-f16 feature");
      }
      if(experimentalMobile){
        // Separate MLC/WebLLM q4f16 runtime rather than ONNX constant folding.
        self.postMessage({type:"stage",message:"GPU preflight passed; loading alternative WebLLM runtime",button:"Loading WebLLM…"});
        const {CreateMLCEngine,prebuiltAppConfig}=await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.89/+esm");
        self.postMessage({type:"stage",message:"WebLLM imported; loading compressed model weights",button:"Preparing 360M…"});
        mobileEngine=await CreateMLCEngine(MOBILE_MODEL_ID,{
          appConfig:mobileModelAppConfig(prebuiltAppConfig),
          initProgressCallback:p=>{
            const n=Number(p?.progress);
            self.postMessage({type:"progress",file:String(p?.text||"WebLLM weights").slice(0,100),percent:Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n*100))):null});
          }
        });
        self.postMessage({type:"ready",model:activeModel,backend:"webllm"});
        return;
      }
      self.postMessage({type:"stage",message:"GPU preflight complete; loading model library",button:"Loading library…"});
      const {pipeline}=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm");
      self.postMessage({type:"stage",message:"Model library loaded; preparing/downloading weights",button:"Preparing weights…"});
      generator=await pipeline("text-generation",MODELS[activeModel],{
        device:"webgpu",dtype:"q4f16",
        progress_callback: status=>{
          if(status?.status==="progress"||status?.status==="download")
            self.postMessage({type:"progress",file:String(status.file||"model"),percent:status.progress});
        }
      });
      self.postMessage({type:"ready",model:activeModel});
    }catch(error){
      if(generator?.dispose){try{await generator.dispose()}catch{}}
      if(mobileEngine?.unload){try{await mobileEngine.unload()}catch{}}
      generator=null;mobileEngine=null;
      self.postMessage({type:"error",message:String(error?.message||error)});
    }
  }
  if(data.type==="generate"){
    if(!generator&&!mobileEngine){self.postMessage({type:"error",id:data.id,message:"Model is not loaded"});return;}
    try{
      if(experimentalMobile&&mobileEngine){
        const input=compactAIMessages(data.messages,true);
        const result=await mobileEngine.chat.completions.create(mobileCompletionRequest(input));
        const output=String(result?.choices?.[0]?.message?.content||"").trim();
        if(!output)throw new Error("WebLLM produced empty output");
        self.postMessage({type:"generated",id:data.id,text:output});
        return;
      }
      const response=await generator(compactAIMessages(data.messages,experimentalMobile),narrationGenerationOptions(activeModel,data.style,experimentalMobile));
      const raw=response?.[0]?.generated_text;
      let output=typeof raw==="string"?raw:"";
      if(Array.isArray(raw))output=String(raw.at(-1)?.content||"");
      if(raw&&typeof raw==="object"&&!Array.isArray(raw))output=String(raw.content||"");
      output=output.replace(/^assistant\s*:/i,"").replace(/<\|[^|]+\|>/g,"").trim();
      if(!output)throw new Error("Model returned empty output");
      self.postMessage({type:"generated",id:data.id,text:output});
    }catch(error){self.postMessage({type:"error",id:data.id,message:String(error?.message||error)});}
  }
};
