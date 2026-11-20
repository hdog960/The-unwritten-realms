import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const required=["index.html","app.js","game.js","narration.js","ai-safety.js",
 "ai-worker.js","sw.js","manifest.webmanifest","icon.svg"];
test("published Pages artifact contains every required local module and exact source bytes",()=>{
 for(const file of required){
  const original=readFileSync(join(root,file));
  const built=readFileSync(join(root,"dist",file));
  assert.deepEqual(built,original,"Pages asset missing or modified: "+file);
 }
});
test("GitHub Pages publishes the SAME artifact tested by mobile Chromium",()=>{
 const workflow=readFileSync(join(root,".github/workflows/pages.yml"),"utf8");
 const quality=readFileSync(join(root,".github/workflows/quality.yml"),"utf8");
 const smoke=readFileSync(join(root,"tests/browser-smoke.mjs"),"utf8");
 assert.match(workflow,/path: dist/);
 assert.match(workflow,/npm test/);
 assert.match(quality,/npm run build/);
 assert.match(smoke,/\b"dist"\)/);
 assert.doesNotMatch(workflow,/cp index\.html app\.js game\.js/);
 assert.ok(existsSync(join(root,"dist","narration.js")));
 assert.ok(existsSync(join(root,"dist","ai-safety.js")));
});
