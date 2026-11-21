import test from "node:test";import assert from "node:assert/strict";
import {CPU_MODEL_ID,cpu360PipelineOptions,createCpu360Pipeline,cpu360GenerationOptions} from "../cpu-360.js";
test("360M compatibility uses a genuine quantized ONNX CPU pipeline, not WebGPU",async()=>{
 const seen=[];const mocked=async(task,model,options)=>{seen.push({task,model,options});return {ok:true}};
 assert.deepEqual(await createCpu360Pipeline(mocked,()=>{}),{ok:true});
 assert.equal(CPU_MODEL_ID,"onnx-community/SmolLM2-360M-Instruct-ONNX");
 assert.equal(seen[0].task,"text-generation");
 assert.equal(seen[0].model,CPU_MODEL_ID);
 assert.equal(seen[0].options.device,"wasm");
 assert.equal(seen[0].options.dtype,"q8");
 assert.equal(cpu360GenerationOptions().max_new_tokens,40);
 assert.equal(cpu360GenerationOptions().do_sample,false);
});
