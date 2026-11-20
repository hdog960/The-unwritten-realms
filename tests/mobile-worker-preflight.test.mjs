import test from "node:test";
import assert from "node:assert/strict";

test("mobile large-model worker rejects unsupported WebGPU before any download", async () => {
  const originalSelf=globalThis.self;
  const events=[];
  const calls=[];
  try {
    globalThis.self={
      navigator:{gpu:{requestAdapter:async options=>{
        calls.push(options);
        return {features:new Set()};
      }}},
      postMessage:message=>events.push(message)
    };
    await import("../ai-worker.js?preflight-test");
    assert.equal(typeof globalThis.self.onmessage,"function");
    await globalThis.self.onmessage({data:{type:"init",model:"enhanced",mobileExperimental:true}});
    assert.equal(calls.length,1);
    assert.equal(calls[0],undefined,"Use the default adapter; do not force a low-power incompatible GPU");
    assert.equal(events.length,3,"Worker must explain both loading stages before reporting GPU failure");
    assert.deepEqual(events.slice(0,2).map(x=>x.type),["stage","stage"]);
    assert.match(events[0].message,/worker started/);
    assert.match(events[1].message,/shader-f16/);
    assert.equal(events[2].type,"error");
    assert.match(events[2].message,/GPU-04:.*shader-f16/);
    assert.equal(events.some(x=>x.type==="progress"||x.type==="ready"),false);
    await globalThis.self.onmessage({data:{type:"generate",id:42,messages:[]}});
    assert.equal(events.at(-1).id,42);
    assert.match(events.at(-1).message,/not loaded/);
  } finally {
    if(originalSelf===undefined)delete globalThis.self;
    else globalThis.self=originalSelf;
  }
});
