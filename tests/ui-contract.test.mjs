import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = name => readFileSync(new URL("../"+name,import.meta.url),"utf8");
test("every referenced application element has an HTML id",()=>{
  const app=file("app.js"),html=file("index.html");
  const ids=[...app.matchAll(/el\("([^"]+)"\)/g)].map(m=>m[1]);
  for(const id of ids) assert.ok(html.includes('id="'+id+'"'),"Missing element: "+id);
});
test("release assets are explicitly cached for offline startup",()=>{
  const sw=file("sw.js"),html=file("index.html");
  for(const name of ["index.html","app.js","game.js","narration.js","ai-safety.js","ai-worker.js","icon.svg"]) {
    assert.ok(sw.includes(name),name+" not cached");
  }
  assert.match(sw,/unwritten-realms-shell-v13/);
  assert.match(html,/Prototype v0\.6\.7/);
});
test("saved-adventure key and schema remain compatible",()=>{
  const app=file("app.js"),game=file("game.js");
  assert.ok(app.includes('const STORE = "unwritten-realms-save-v1"'));
  assert.ok(game.includes("export const VERSION = 1;"));
  assert.ok(app.includes("loadGame(await file.text())"));
  assert.ok(app.includes("setUndo(state)"));
  assert.ok(app.includes("persist()"));
});
test("clearing text option and the old AI compatibility guard remain in place",()=>{
  const html=file("index.html"),app=file("app.js");
  for(const name of ["text-size","undo-last","import-save","recap-result","chapter-label","panel-map","clear-last","story-message","mobile-ai-experiment","mobile-ai-consent","load-ai-mobile"]) assert.ok(html.includes('id="'+name+'"'));
  assert.ok(app.includes("resolveAIChoice"));
  assert.ok(app.includes("clearLoadWatchdog"));
});

test("iPhone 360M consent is enforced on click, not by a stale disabled attribute",()=>{
  const html=file("index.html"),app=file("app.js");
  const button=html.match(/<button[^>]*id="load-ai-mobile"[^>]*>/)?.[0];
  assert.ok(button,"Missing experimental button");
  assert.doesNotMatch(button,/\sdisabled(?:\s|=|>)/);
  assert.match(app,/el\("load-ai-mobile"\)\.disabled = loading;/);
  assert.match(app,/\(choice === "mobile-enhanced" \|\| choice==="mobile-cpu"\) && !el\("mobile-ai-consent"\)\.checked/);
  const guard='(choice === "mobile-enhanced" || choice==="mobile-cpu") && !el("mobile-ai-consent").checked';
  assert.ok(app.indexOf(guard)>=0,"Both 360M backends require the original checkbox consent");
  assert.ok(app.indexOf(guard) < app.indexOf('worker = new Worker('),"Consent enforced before Worker creation");
});

test("visible 360M status and versioned Home Screen assets are wired",()=>{
  const html=file("index.html"),app=file("app.js"),sw=file("sw.js"),worker=file("ai-worker.js");
  assert.match(html,/id="mobile-ai-status"/);
  assert.match(html,/app\.js\?v=067/);
  assert.match(app,/MOBILE_AI_BUILD = "v0\.6\.7"/);
  assert.match(app,/ai-worker\.js\?v=067/);
  assert.match(sw,/app\.js\?v=067/);
  assert.match(sw,/ai-worker\.js\?v=067/);
  assert.match(worker,/type:"stage"/);
  assert.match(app,/if \(data.type === "stage"\)/);
  assert.match(app,/GPU-01: WebGPU is unavailable/);
});

test("standalone classic bootstrap identifies failed module and supports safe repair",()=>{
 const html=file("index.html"),app=file("app.js");
 assert.match(html,/id="repair-home-app"/);
 assert.match(html,/STARTUP-01:/);
 assert.match(html,/STARTUP-02:/);
 assert.match(html,/app-refresh=067/);
 assert.match(html,/unwritten-realms-shell-/);
 assert.match(app,/__unwrittenBoot\?\.connected\(\)/);
 assert.doesNotMatch(html,/localStorage\.clear\(/);
 assert.doesNotMatch(html,/localStorage\.removeItem\(/);
});

test("mobile 360M route uses WebLLM and persists unfinished-attempt warnings",()=>{
 const html=file("index.html"),app=file("app.js"),worker=file("ai-worker.js"),sw=file("sw.js");
 assert.match(html,/id="retry-360m"/);
 assert.match(app,/detectInterruptedAttempt/);
 assert.match(app,/SAFETY-02:/);
 assert.match(worker,/@mlc-ai\/web-llm@0\.2\.89/);
 assert.match(sw,/ai-attempt\.js/);
 assert.match(sw,/mobile-llm\.js/);
});

test("360M CPU compatibility route does not require WebGPU",()=>{
 const a=file("app.js"),h=file("index.html"),w=file("ai-worker.js"),sw=file("sw.js");
 assert.match(h,/id="load-ai-cpu"/);
 assert.match(a,/startAI\("mobile-cpu"\)/);
 assert.match(a,/if \(!navigator.gpu && !mobileCpu\)/);
 assert.match(w,/backend==="wasm"/);
 assert.match(w,/createCpu360Pipeline/);
 assert.match(sw,/cpu-360\.js/);
});

test("CPU and GPU 360M have distinct backends",()=>{
 const app=file("app.js");
 assert.match(app,/activeModel === selected.model && activeBackend === requestedBackend/);
 assert.match(app,/requestedBackend=mobileCpu\?"wasm"/);
});
