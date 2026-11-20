import test from "node:test";
import assert from "node:assert/strict";
import { isAppleMobile, checkModelSupport, resolveAIChoice, compactAIMessages, narrationGenerationOptions } from "../ai-safety.js";

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

test("only explicit opt-in enables larger model on Apple mobile",()=>{
  for(const userAgent of ["iPhone","iPad"]){
    const d={userAgent};
    assert.equal(checkModelSupport("enhanced",d).allowed,false);
    assert.equal(checkModelSupport("enhanced",d,{experimentalMobile:false}).allowed,false);
    assert.equal(checkModelSupport("enhanced",d,{experimentalMobile:true}).allowed,true);
    assert.equal(resolveAIChoice("clear",d).model,"light");
    assert.equal(resolveAIChoice("mobile-enhanced",d).model,"enhanced");
  }
});
test("desktop-like standalone mobile fingerprints must not select 360M via clear writing",()=>{
  const spoofed={userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",platform:"MacIntel",maxTouchPoints:0,mobileExperience:true};
  assert.equal(isAppleMobile(spoofed.userAgent,spoofed.platform,spoofed.maxTouchPoints),false);
  assert.equal(resolveAIChoice("clear",spoofed).model,"light");
  assert.equal(resolveAIChoice("mobile-enhanced",spoofed).model,"enhanced");
  assert.equal(resolveAIChoice("clear",{userAgent:"Mozilla/5.0 Windows NT",platform:"Win32",mobileExperience:false}).model,"enhanced");
});
test("larger mobile context and generation remain bounded without mutating prompts",()=>{
  const input=[{role:"system",content:"S".repeat(3000)},{role:"user",content:"U".repeat(3000)}];
  const result=compactAIMessages(input,true);
  assert.equal(result[0].content.length,900);
  assert.equal(result[1].content.length,1300);
  assert.equal(input[0].content.length,3000);
  assert.strictEqual(compactAIMessages(input,false),input);
  assert.deepEqual(narrationGenerationOptions("enhanced","normal",true),
    {max_new_tokens:64,do_sample:false,repetition_penalty:1.12,return_full_text:false});
  assert.equal(narrationGenerationOptions("light","normal",false).max_new_tokens,105);
  assert.equal(narrationGenerationOptions("light","clear",false).max_new_tokens,75);
});
