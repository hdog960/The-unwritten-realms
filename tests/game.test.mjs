import test from "node:test";
import assert from "node:assert/strict";
import { newGame, loadGame, applyAction, prompts, promptFor } from "../game.js";

const act = (s, words) => applyAction(s, words).state;
test("new save starts with stable stats and story", () => {
  const s = newGame();
  assert.equal(s.hp, 30);
  assert.equal(s.gold, 12);
  assert.equal(s.scene, "crossroads");
  assert.ok(s.history[0].text.includes("fork"));
  assert.deepEqual(loadGame(JSON.stringify(s)), s);
});
test("invalid or incompatible saved data is rejected", () => {
  assert.equal(loadGame("not json"), null);
  assert.equal(loadGame('{"version":99}'), null);
  assert.equal(loadGame({ ...newGame(), scene: "unknown" }), null);
});
test("free text travels from crossroads to valley and chapel", () => {
  let s = act(newGame(), "I follow the bells left into the mist");
  assert.equal(s.scene, "valley");
  s = act(s, "I enter the ruined chapel");
  assert.equal(s.scene, "chapel");
  s = act(s, "I take the silver relic from the altar");
  assert.ok(s.inventory.includes("Silver moon charm"));
  s = act(s, "I leave");
  assert.equal(s.scene, "valley");
});
test("ogre can be bargained with, opens the keep", () => {
  let s = act(newGame(), "I head right toward the bridge");
  assert.equal(s.scene, "bridge");
  s = act(s, "I pay the ogre a toll of 3 coins");
  assert.equal(s.gold, 9);
  assert.equal(s.flags.ogre, "paid");
  s = act(s, "I cross to the fortress");
  assert.equal(s.scene, "fortress");
});
test("creative use of chain can resolve ogre", () => {
  let s = act(newGame(), "I approach the bridge");
  s = act(s, "I shoot the chain above the ogre");
  assert.equal(s.flags.ogre, "fled");
  assert.equal(s.hp, 30);
});
test("forest route and hunter are reachable", () => {
  let s = act(newGame(), "I go into the forest");
  assert.equal(s.scene, "forest");
  s = act(s, "I follow the smoke to the hunter's camp");
  assert.equal(s.scene, "camp");
  s = act(s, "I speak to the hunter");
  assert.equal(s.flags.campMet, true);
});
test("any nonempty player text produces a saved response", () => {
  let s = act(newGame(), "I recite a strange poem backward and juggle three acorns");
  assert.equal(s.turn, 1);
  assert.equal(s.history.at(-2).role, "player");
  assert.equal(s.history.at(-1).role, "narrator");
  assert.ok(s.history.at(-1).text.length > 25);
});
test("save stays bounded through many actions", () => {
  let s = newGame();
  for (let i = 0; i < 100; i++) s = act(s, "look around");
  assert.equal(s.history.length, 60);
  assert.equal(s.turn, 100);
  assert.ok(loadGame(JSON.stringify(s)));
});
test("prompts and local model context are derived from gameplay", () => {
  const result = applyAction(newGame(), "I head toward the bridge");
  assert.ok(prompts(result.state).includes("Talk to the ogre"));
  const chat = promptFor(result);
  assert.equal(chat[0].role, "system");
  assert.ok(chat[1].content.includes("I head toward the bridge"));
});

test("reeds can be searched exactly once and yield three crowns", () => {
  let s = act(newGame(), "I go left toward the valley");
  s = act(s, "I search the reeds");
  assert.equal(s.gold, 15);
  s = act(s, "I search the reeds again");
  assert.equal(s.gold, 15);
});
test("chapel inspection reveals discoverable relic", () => {
  let s = act(newGame(), "I follow the bell");
  s = act(s, "enter the chapel");
  s = act(s, "inspect the altar");
  assert.ok(s.history.at(-1).text.includes("silver moon charm"));
});
test("hunter stew heals eight without exceeding maximum", () => {
  let s = act(newGame(), "go into the forest");
  s = act(s, "follow the smoke to camp");
  s.hp = 14;
  s = act(s, "eat some stew");
  assert.equal(s.hp, 22);
});
test("unknown free-form input gets experimental improvisation prompt", () => {
  const r = applyAction(newGame(), "I paint a dragon with starlight on my shield");
  assert.equal(r.freeform, true);
  assert.ok(promptFor(r)[0].content.includes("ANY action"));
});
