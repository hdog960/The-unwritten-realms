import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname } from "node:path";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const types = { ".html":"text/html", ".js":"text/javascript", ".json":"application/json", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".css":"text/css" };
const server=createServer(async (req,res)=>{
  const path = decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  const filename=resolve(root, "."+ (path === "/" ? "/index.html" : path));
  if (!filename.startsWith(root+"/")) { res.writeHead(403).end(); return; }
  try {
    const info=await stat(filename);
    if (!info.isFile()) throw new Error("not file");
    const data=await readFile(filename);
    res.writeHead(200,{"Content-Type":types[extname(filename)]||"application/octet-stream","Cache-Control":"no-store"});
    res.end(data);
  }catch{res.writeHead(404).end("Not found");}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin="http://127.0.0.1:"+server.address().port;
let browser;
const errorList=[];
try {
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1"
  });
  const page=await context.newPage();
  page.on("pageerror",e=>errorList.push(String(e)));
  page.on("dialog",dialog=>dialog.accept());
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"gpu",{configurable:true,value:undefined});
  });
  await page.goto(origin+"/",{waitUntil:"domcontentloaded"});
  assert.match(await page.locator(".footer").innerText(),/v0\.6\.6/);
  assert.match(await page.locator("#location").innerText(),/Hollow Road/);
  assert.match(await page.locator("#mobile-ai-status").innerText(),/v0\.6\.6 controls connected/);
  assert.equal(await page.locator("#repair-home-app").isVisible(),false);
  await page.locator("#action").fill("I sneak toward the bridge");
  await page.locator("#submit").click();
  assert.match(await page.locator("#location").innerText(),/Broken Bridge/);
  assert.match(await page.locator("#turn-text").innerText(),/TURN 1/);
  await page.locator("#action").fill("I tell the ogre a funny story");
  await page.locator("#submit").click();
  assert.match(await page.locator("#turn-text").innerText(),/TURN 2/);
  const backup=await page.evaluate(()=>localStorage.getItem("unwritten-realms-save-v1"));
  assert.ok(backup && JSON.parse(backup).flags.ogre==="charmed");
  await page.locator('[data-panel="journal"]').click();
  assert.match(await page.locator("#journal-info").innerText(),/ogre/i);
  await page.locator("#show-recap").click();
  assert.match(await page.locator("#recap-result").innerText(),/Broken Bridge/);
  await page.locator("#undo-last").click();
  assert.match(await page.locator("#turn-text").innerText(),/TURN 1/);
  await page.locator('[data-panel="map"]').click();
  assert.match(await page.locator("#map-info").innerText(),/Broken Bridge/);
  await page.reload({waitUntil:"domcontentloaded"});
  assert.match(await page.locator("#turn-text").innerText(),/TURN 1/);
  await page.locator('[data-panel="journal"]').click();
  await page.locator("#text-size").click();
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("readable")),true);
  await page.locator("#restart").click();
  assert.match(await page.locator("#turn-text").innerText(),/TURN 0/);
  await page.locator("#import-save").setInputFiles({name:"unwritten-backup.json",mimeType:"application/json",buffer:Buffer.from(backup)});
  // File.text() and the confirmation run asynchronously after the change event;
  // wait for the actual restored state rather than racing the event handler.
  await page.waitForFunction(() => document.querySelector("#turn-text")?.textContent === "TURN 2", null, {timeout:10000});
  assert.match(await page.locator("#save-status").innerText(),/Adventure restored and saved/);
  assert.match(await page.locator("#turn-text").innerText(),/TURN 2/);
  await page.evaluate(() => {
    const key="unwritten-realms-save-v1";
    const saved=JSON.parse(localStorage.getItem(key));
    saved.history.at(-1).text="The moon is made of confusing spaghetti.";
    localStorage.setItem(key,JSON.stringify(saved));
  });
  await page.reload({waitUntil:"domcontentloaded"});
  assert.equal(await page.locator("#clear-last").isDisabled(),false);
  await page.locator("#clear-last").click();
  assert.match(await page.locator("#story-message").innerText(),/verified game narration restored/);
  assert.ok(!(await page.locator("#story").innerText()).includes("confusing spaghetti"));
  // Panel buttons toggle closed when already open; only open AI if hidden.
  if (!(await page.locator("#load-ai-enhanced").isVisible())) {
    await page.locator('[data-panel="ai"]').click();
  }
  await page.locator("#load-ai-enhanced").click();
  assert.match(await page.locator("#ai-status").innerText(),/WebGPU is unavailable/);
  // iPhone experimental model must not start without active checkbox consent.
  const experiment=page.locator("#load-ai-mobile");
  assert.equal(await experiment.isVisible(),true);
  assert.equal(await experiment.isEnabled(),true);
  assert.equal(await page.locator("#mobile-ai-consent").isChecked(),false);
  const noConsentSave=await page.evaluate(()=>localStorage.getItem("unwritten-realms-save-v1"));
  await experiment.click();
  assert.match(await page.locator("#ai-status").innerText(),/Acknowledge the experimental 360M warning/);
  assert.match(await page.locator("#mobile-ai-status").innerText(),/Acknowledge the experimental 360M warning/);
  assert.equal(await page.evaluate(()=>localStorage.getItem("unwritten-realms-save-v1")),noConsentSave);
  await page.locator("#mobile-ai-consent").check();
  assert.equal(await experiment.isEnabled(),true);
  const saveBefore=await page.evaluate(()=>localStorage.getItem("unwritten-realms-save-v1"));
  await experiment.click();
  assert.match(await page.locator("#ai-status").innerText(),/GPU-01: WebGPU is unavailable/);
  assert.match(await page.locator("#mobile-ai-status").innerText(),/GPU-01: WebGPU is unavailable/);
  assert.equal(await page.evaluate(()=>localStorage.getItem("unwritten-realms-save-v1")),saveBefore);
  assert.match(await page.locator(".footer").innerText(),/v0\.6\.6/);
  if(errorList.length)throw new Error("Browser JS errors: "+errorList.join(" | "));
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller),null,{timeout:10000}).catch(()=>{});
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded",timeout:15000});
  assert.match(await page.locator("#location").innerText(),/Broken Bridge/);
  assert.match(await page.locator("#turn-text").innerText(),/TURN 2/);
  // Reproduce the exact symptom: HTML works but the ES-module app never loads.
  // The independent inline bootstrap must detect it and preserve saves on repair.
  const repairContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try {
    const repairPage=await repairContext.newPage();
    let blockModule=true;
    await repairPage.route("**/app.js?v=066",route=>blockModule?route.abort():route.continue());
    await repairPage.goto(origin+"/",{waitUntil:"domcontentloaded"});
    assert.match(await repairPage.locator("#mobile-ai-status").innerText(),/v0\.6\.6/);
    await repairPage.evaluate(data=>localStorage.setItem("unwritten-realms-save-v1",data),backup);
    await repairPage.locator("#load-ai-mobile").click();
    assert.match(await repairPage.locator("#mobile-ai-status").innerText(),/STARTUP-01/);
    assert.equal(await repairPage.locator("#repair-home-app").isVisible(),true);
    blockModule=false;
    await repairPage.locator("#repair-home-app").click();
    await repairPage.waitForURL(/app-refresh=066/);
    await repairPage.waitForFunction(()=>document.querySelector("#mobile-ai-status")?.textContent.includes("controls connected"));
    assert.match(await repairPage.locator("#turn-text").innerText(),/TURN 2/);
    assert.equal(await repairPage.evaluate(()=>JSON.parse(localStorage.getItem("unwritten-realms-save-v1")).version),1);
    assert.equal(await repairPage.locator("#repair-home-app").isVisible(),false);
  }finally{await repairContext.close();}
  // Separate iPhone-shaped browser with an inert mocked Worker: this verifies the
  // 360M selection/consent handoff without pretending to run a GPU model on CI.
  const gatedContext=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    // Reproduce the user screenshot: iPhone-size Home Screen view, but Safari
    // exposes a desktop-like user agent/platform so the old UI hid 360M entirely.
    userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15"
  });
  try {
    const gatedPage=await gatedContext.newPage();
    gatedPage.on("pageerror",e=>errorList.push("opt-in: "+String(e)));
    await gatedPage.addInitScript(()=>{
      Object.defineProperty(navigator,"gpu",{configurable:true,value:{}});
      Object.defineProperty(navigator,"platform",{configurable:true,value:"MacIntel"});
      Object.defineProperty(navigator,"maxTouchPoints",{configurable:true,value:0});
      Object.defineProperty(navigator,"standalone",{configurable:true,value:true});
      window.__workerInit=null;
      window.Worker=class MockWorker {
        constructor(){window.__workerCreated=(window.__workerCreated||0)+1;}
        postMessage(data){
          window.__workerInit=data;
          if(data.type==="init"){
            this.onmessage?.({data:{type:"stage",message:"GPU adapter passed",button:"Checking adapter…"}});
            this.onmessage?.({data:{type:"ready",model:data.model}});
          }
        }
        terminate(){}
      };
    });
    await gatedPage.goto(origin+"/",{waitUntil:"domcontentloaded"});
    assert.equal(await gatedPage.evaluate(()=>navigator.platform),"MacIntel");
    assert.equal(await gatedPage.evaluate(()=>navigator.maxTouchPoints),0);
    assert.equal(await gatedPage.locator("#mobile-ai-experiment").isVisible(),true);
    assert.match(await gatedPage.locator("#load-ai-enhanced").innerText(),/same small AI/);
    assert.equal(await gatedPage.locator("#load-ai-mobile").isEnabled(),true);
    assert.equal(await gatedPage.locator("#mobile-ai-consent").isChecked(),false);
    await gatedPage.locator("#load-ai-mobile").click();
    assert.match(await gatedPage.locator("#ai-status").innerText(),/Acknowledge the experimental 360M warning/);
    assert.equal(await gatedPage.evaluate(()=>window.__workerCreated||0),0);
    // On a desktop-looking standalone viewport, 'Clearer writing' MUST stay small.
    await gatedPage.locator("#load-ai-enhanced").click();
    let init=await gatedPage.evaluate(()=>window.__workerInit);
    assert.equal(init.model,"light");
    assert.notEqual(init.mobileExperimental,true);
    await gatedPage.locator("#disable-ai").click();
    // Emulate Safari: checkbox visually checked without the usual change event.
    // The button must still work because the click handler reads .checked itself.
    await gatedPage.locator("#mobile-ai-consent").evaluate(el=>{el.checked=true;});
    assert.equal(await gatedPage.locator("#mobile-ai-consent").isChecked(),true);
    assert.equal(await gatedPage.locator("#load-ai-mobile").isEnabled(),true);
    await gatedPage.locator("#load-ai-mobile").click();
    init=await gatedPage.evaluate(()=>window.__workerInit);
    assert.equal(init.type,"init");
    assert.equal(init.model,"enhanced");
    assert.equal(init.mobileExperimental,true);
    assert.equal(init.backend,"webllm");
    assert.equal(await gatedPage.evaluate(()=>window.__workerCreated),2);
    assert.match(await gatedPage.locator("#ai-status").innerText(),/Larger 360M AI loaded/);
    assert.match(await gatedPage.locator("#mobile-ai-status").innerText(),/Larger 360M AI loaded/);
    assert.equal(await gatedPage.evaluate(()=>JSON.parse(localStorage.getItem("unwritten-realms-save-v1")).version),1);
    await gatedPage.locator("#disable-ai").click();
    assert.match(await gatedPage.locator("#ai-status").innerText(),/AI off/);
    await gatedPage.reload({waitUntil:"domcontentloaded"});
    assert.equal(await gatedPage.locator("#mobile-ai-experiment").isVisible(),true);
    assert.equal(await gatedPage.locator("#mobile-ai-consent").isChecked(),false);
    assert.equal(await gatedPage.locator("#load-ai-mobile").isEnabled(),true);
    await gatedPage.locator("#load-ai-mobile").click();
    assert.match(await gatedPage.locator("#ai-status").innerText(),/Acknowledge the experimental 360M warning/);
    assert.equal(await gatedPage.evaluate(()=>window.__workerCreated||0),0);
    await gatedPage.evaluate(()=>localStorage.setItem("unwritten-realms-360m-attempt-v1",
      JSON.stringify({active:true,interruptions:0,phase:"Loading WebLLM weights"})));
    await gatedPage.reload({waitUntil:"domcontentloaded"});
    assert.match(await gatedPage.locator("#mobile-ai-status").innerText(),/SAFETY-02/);
    assert.equal(await gatedPage.locator("#retry-360m").isVisible(),true);
    await gatedPage.locator("#mobile-ai-consent").check();
    await gatedPage.locator("#load-ai-mobile").click();
    assert.match(await gatedPage.locator("#mobile-ai-status").innerText(),/SAFETY-01/);
    assert.equal(await gatedPage.evaluate(()=>window.__workerCreated||0),0);
    await gatedPage.locator("#retry-360m").click();
    assert.equal(await gatedPage.locator("#mobile-ai-consent").isChecked(),false);
    await gatedPage.locator("#mobile-ai-consent").check();
    await gatedPage.locator("#load-ai-mobile").click();
    assert.equal((await gatedPage.evaluate(()=>window.__workerInit)).backend,"webllm");
  }finally{await gatedContext.close();}
  if(errorList.length)throw new Error("Browser JS errors: "+errorList.join(" | "));
  console.log("Mobile Chromium smoke PASS: story + saves + offline + opt-in WebGPU-unavailable path + mocked 360M worker handoff (not real iPhone inference).");
} finally {
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
}
