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
    assert.equal(calls[0].powerPreference,"low-power");
    assert.equal(events.length,1);
    assert.equal(events[0].type,"error");
    assert.match(events[0].message,/shader-f16/);
    assert.equal(events.some(x=>x.type==="progress"||x.type==="ready"),false);
    await globalThis.self.onmessage({data:{type:"generate",id:42,messages:[]}});
    assert.equal(events.at(-1).id,42);
    assert.match(events.at(-1).message,/not loaded/);
  } finally {
    if(originalSelf===undefined)delete globalThis.self;
    else globalThis.self=originalSelf;
  }
});
