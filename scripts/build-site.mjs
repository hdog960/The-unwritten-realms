// Release parity: package and validate the EXACT static folder GitHub Pages deploys.
// A missing local JS import must fail CI rather than blank the installed iPhone game.
import { mkdir, rm, copyFile, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join, posix } from "node:path";

const assets=[
  "index.html", "app.js", "game.js", "narration.js", "ai-safety.js",
  "ai-worker.js", "sw.js", "manifest.webmanifest", "icon.svg"
];
const required=new Set(assets);
const dist="dist";
function target(from,ref) {
  if (!ref.startsWith("./") && !ref.startsWith("../")) return null;
  const pathname=ref.split(/[?#]/,1)[0];
  const resolved=posix.normalize(posix.join(posix.dirname(from),pathname));
  if (resolved.startsWith("../")||resolved.startsWith("/")||resolved==="..") throw new Error("Outside app shell: "+from+" -> "+ref);
  return resolved==="."||resolved==="./"?"index.html":resolved;
}
function assertPackaged(file,ref) {
  const path=target(file,ref);
  if(path&&!required.has(path))throw new Error("Unpublished local dependency: "+file+" -> "+ref+" (expected "+path+")");
}
async function main(){
  // Validate from real source, not a browser-served repository root.
  for(const file of assets.filter(x=>x.endsWith(".js"))){
    const code=await readFile(file,"utf8");
    for(const match of code.matchAll(/\b(?:from\s+|import\s*\(\s*)["'](\.[^"']+)["']/g))assertPackaged(file,match[1]);
  }
  const html=await readFile("index.html","utf8");
  for(const match of html.matchAll(/\b(?:src|href)=["'](\.[^"']+)["']/g))assertPackaged("index.html",match[1]);
  const sw=await readFile("sw.js","utf8");
  const shellMatch=sw.match(/const SHELL = (\[[^;]+\]);/);
  if(!shellMatch)throw new Error("Service worker shell list missing");
  for(const ref of JSON.parse(shellMatch[1]))assertPackaged("sw.js",ref);
  const manifest=JSON.parse(await readFile("manifest.webmanifest","utf8"));
  for(const icon of manifest.icons||[])assertPackaged("manifest.webmanifest",icon.src);
  if(!assets.includes("narration.js")||!assets.includes("ai-safety.js"))throw new Error("Narration/safety dependency missing");
  await rm(dist,{recursive:true,force:true});
  await mkdir(dist,{recursive:true});
  for(const file of assets){
    await copyFile(file,join(dist,file));
    await access(join(dist,file));
  }
  await writeFile(join(dist,".nojekyll"),"");
  // Confirm deployed bytes equal repository bytes, including all ES module imports.
  for(const file of assets){
    const source=await readFile(file);
    const published=await readFile(join(dist,file));
    if(!source.equals(published))throw new Error("Published file differs from source: "+file);
  }
  console.log("GitHub Pages exact artifact verified: "+assets.join(", "));
}
await main();
