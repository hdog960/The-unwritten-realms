import test from "node:test";
import assert from "node:assert/strict";
import { isAppleMobile, checkModelSupport } from "../ai-safety.js";

test("iPhone iPad and touch-based iPadOS reject large GPU model", () => {
  for (const d of [
    {userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)", platform:"iPhone", maxTouchPoints:5},
    {userAgent:"Mozilla/5.0 (iPad; CPU OS 26_0)", platform:"iPad", maxTouchPoints:5},
    {userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform:"MacIntel", maxTouchPoints:5}
  ]) {
    assert.equal(isAppleMobile(d.userAgent,d.platform,d.maxTouchPoints),true);
    const v=checkModelSupport("enhanced",d);
    assert.equal(v.allowed,false);
    assert.match(v.message,/save is safe/);
  }
});
test("lightweight model stays selectable on Apple mobile",()=>{
  assert.equal(checkModelSupport("light",{userAgent:"iPhone"}).allowed,true);
});
test("desktop browsers can still attempt larger model",()=>{
  assert.equal(checkModelSupport("enhanced",{userAgent:"Mozilla/5.0 Windows NT",platform:"Win32",maxTouchPoints:0}).allowed,true);
  assert.equal(checkModelSupport("enhanced",{userAgent:"Mozilla/5.0 Macintosh",platform:"MacIntel",maxTouchPoints:0}).allowed,true);
});
test("model guard never mistakes a non-Apple Android phone for iPhone",()=>{
  assert.equal(checkModelSupport("enhanced",{userAgent:"Mozilla/5.0 Linux; Android 15"}).allowed,true);
});
