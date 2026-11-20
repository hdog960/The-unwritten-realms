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
  assert.match(sw,/unwritten-realms-shell-v9/);
  assert.match(html,/Prototype v0\.6\.3/);
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
  assert.match(app,/choice === "mobile-enhanced" && !el\("mobile-ai-consent"\)\.checked/);
  assert.ok(app.indexOf('choice === "mobile-enhanced" && !el("mobile-ai-consent").checked') < app.indexOf('worker = new Worker('));
});

test("visible 360M status and versioned Home Screen assets are wired",()=>{
  const html=file("index.html"),app=file("app.js"),sw=file("sw.js"),worker=file("ai-worker.js");
  assert.match(html,/id="mobile-ai-status"/);
  assert.match(html,/app\.js\?v=063/);
  assert.match(app,/MOBILE_AI_BUILD = "v0\.6\.3"/);
  assert.match(app,/ai-worker\.js\?v=063/);
  assert.match(sw,/app\.js\?v=063/);
  assert.match(sw,/ai-worker\.js\?v=063/);
  assert.match(worker,/type:"stage"/);
  assert.match(app,/if \(data.type === "stage"\)/);
  assert.match(app,/GPU-01: WebGPU is unavailable/);
});
