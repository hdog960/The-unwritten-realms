import test from "node:test";
import assert from "node:assert/strict";
import { checkModelSupport, resolveAIChoice } from "../ai-safety.js";
import { newGame, applyAction, promptFor } from "../game.js";

test("iPhone clearer button routes to the safe lightweight model and clear style", () => {
  const device = {userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)",platform:"iPhone",maxTouchPoints:5};
  const choice = resolveAIChoice("clear",device);
  assert.deepEqual(choice,{model:"light",style:"clear",label:"Clear writing (small AI)"});
  assert.equal(checkModelSupport(choice.model,device).allowed,true);
  assert.equal(checkModelSupport("enhanced",device).allowed,false);
});
test("iPad desktop-mode Safari is treated as mobile Apple device",()=>{
  const choice = resolveAIChoice("clear",{userAgent:"Macintosh",platform:"MacIntel",maxTouchPoints:5});
  assert.equal(choice.model,"light");
  assert.equal(choice.style,"clear");
});
test("desktop clearer button keeps optional larger model",()=>{
  const choice = resolveAIChoice("clear",{userAgent:"Windows NT 10.0",platform:"Win32"});
  assert.equal(choice.model,"enhanced");
  assert.equal(choice.style,"normal");
});
test("iPhone normal button stays lightweight",()=>{
  assert.equal(resolveAIChoice("light",{userAgent:"iPhone"}).model,"light");
  assert.equal(resolveAIChoice("light",{userAgent:"iPhone"}).style,"normal");
});
test("clear-writing prompt is shorter and uses canonical consequences",()=>{
  const result=applyAction(newGame(),"I walk to the bridge");
  const clear=promptFor(result,"clear");
  const ordinary=promptFor(result);
  assert.ok(clear[0].content.includes("simple English"));
  assert.ok(clear[1].content.includes("Action: I walk to the bridge"));
  assert.ok(clear[1].content.includes("Result:"));
  assert.ok(clear[1].content.length < ordinary[1].content.length);
});
