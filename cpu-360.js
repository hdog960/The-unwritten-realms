// Stable 360M compatibility route: real 8-bit ONNX, single-thread WebAssembly.
export const CPU_MODEL_ID="onnx-community/SmolLM2-360M-Instruct-ONNX";
export function cpu360PipelineOptions(progress_callback){return {device:"wasm",dtype:"q8",progress_callback};}
export async function createCpu360Pipeline(pipeline,progress_callback){
 if(typeof pipeline!=="function")throw new TypeError("Missing Transformers.js pipeline");
 return pipeline("text-generation",CPU_MODEL_ID,cpu360PipelineOptions(progress_callback));
}
export function cpu360GenerationOptions(){return {max_new_tokens:40,do_sample:false,repetition_penalty:1.12,return_full_text:false};}
