import test from "node:test";import assert from "node:assert/strict";
import {mobileModelAppConfig,mobileCompletionRequest,MOBILE_MODEL_ID,createMobileEngine,generateMobileText} from "../mobile-llm.js";
import {readAttempt,detectInterruptedAttempt,beginAttempt,updateAttempt,endAttempt,AI_ATTEMPT_KEY} from "../ai-attempt.js";
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))};};
test("WebLLM 360M has small prefill, context, bounded tokens and fixed model library",()=>{
 const official={model_list:[{model_id:MOBILE_MODEL_ID,model:"https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC",model_lib:"https://cdn.example.test/SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu.wasm",overrides:{context_window_size:4096}}]};
 const config=mobileModelAppConfig(official);const model=config.model_list[0];
 assert.equal(model.model_id,MOBILE_MODEL_ID);
 assert.match(model.model_lib,/SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu\.wasm/);
 assert.equal(official.model_list[0].overrides.context_window_size,4096);
 assert.throws(()=>mobileModelAppConfig({model_list:[]}),/unavailable/);
 assert.equal(model.overrides.context_window_size,1024);
 assert.equal(model.overrides.prefill_chunk_size,128);
 const request=mobileCompletionRequest([{role:"user",content:"Look at the tower"}]);
 assert.equal(request.max_tokens,64);assert.equal(request.stream,false);
});
test("incomplete mobile load is detected across reload with zero game save modifications",()=>{
 const mem=store();mem.setItem("unwritten-realms-save-v1",JSON.stringify({version:1,turn:5}));
 beginAttempt(mem,"worker-start");updateAttempt(mem,"weights");
 let crash=detectInterruptedAttempt(mem);
 assert.equal(crash.wasInterrupted,true);assert.equal(crash.phase,"weights");
 assert.equal(crash.interruptions,1);
 assert.equal(crash.active,false);
 assert.equal(detectInterruptedAttempt(mem).wasInterrupted,false);
 assert.deepEqual(JSON.parse(mem.getItem("unwritten-realms-save-v1")),{version:1,turn:5});
 beginAttempt(mem,"retry");endAttempt(mem,true);
 assert.equal(readAttempt(mem).interruptions,0);
 assert.equal(readAttempt(mem).active,false);
 assert.ok(mem.getItem(AI_ATTEMPT_KEY));
});

test("alternative 360M creation and narration invoke real WebLLM API contract",async()=>{
 const record={model_id:MOBILE_MODEL_ID,model:"https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC",model_lib:"https://example.test/compiled.wasm"};
 const calls=[];let progress="";
 const engine={chat:{completions:{create:async request=>{
   calls.push({type:"generate",request});
   return {choices:[{message:{content:"You approach the moonlit tower."}}]};
 }}}};
 const webllm={prebuiltAppConfig:{model_list:[record]},CreateMLCEngine:async(model,options)=>{
   calls.push({type:"create",model,options});
   options.initProgressCallback({text:"loading weights",progress:0.5});
   return engine;
 }};
 const loaded=await createMobileEngine(webllm,p=>{progress=p.text;});
 assert.strictEqual(loaded,engine);
 assert.equal(calls[0].model,MOBILE_MODEL_ID);
 assert.equal(calls[0].options.appConfig.model_list[0].overrides.prefill_chunk_size,128);
 assert.equal(progress,"loading weights");
 const narration=await generateMobileText(loaded,[{role:"system",content:"A fantasy story"},{role:"user",content:"Enter tower"}]);
 assert.equal(narration,"You approach the moonlit tower.");
 assert.equal(calls[1].request.max_tokens,64);
 assert.equal(calls[1].request.stream,false);
 await assert.rejects(generateMobileText({chat:{completions:{create:async()=>({choices:[]})}}},[]),/empty output/);
});
