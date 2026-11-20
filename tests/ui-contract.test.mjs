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
  assert.match(sw,/unwritten-realms-shell-v6/);
  assert.match(html,/Prototype v0\.6 preview/);
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
