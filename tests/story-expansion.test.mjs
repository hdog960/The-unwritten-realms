import test from "node:test";
import assert from "node:assert/strict";
import { newGame, loadGame, applyAction, prompts, SCENES, questStatus, recap } from "../game.js";

const move = (s, input) => applyAction(s, input).state;
const follow = (actions) => actions.reduce((state, input) => move(state, input), newGame());
const toForest = () => move(newGame(), "I head into the forest");
const toBridge = () => move(newGame(), "I approach the bridge");
const toVault = () => follow([
  "I walk left to the valley", "I enter the chapel", "I take the relic",
  "I leave the chapel", "I return", "I head right toward the bridge",
  "I pay the ogre a toll", "I cross to the fortress", "I descend the stairs"
]);

test("new games retain old save schema and include story milestones", () => {
  const game = newGame();
  assert.equal(game.version, 1);
  assert.deepEqual(loadGame(JSON.stringify(game)), game);
  assert.ok(game.journal.length > 0);
  assert.deepEqual(game.visited, ["crossroads"]);
  assert.equal(Object.keys(SCENES).length, 9);
});
test("legacy v0.4 saves migrate without removing the old adventure", () => {
  const old = newGame();
  delete old.visited;
  delete old.journal;
  for (const name of ["hunterMap","stewUsed","towerLore","vaultOpen","ending","branchFound"]) delete old.flags[name];
  old.scene = "bridge";
  old.turn = 27;
  old.gold = 9;
  const migrated = loadGame(JSON.stringify(old));
  assert.equal(migrated.turn, 27);
  assert.equal(migrated.gold, 9);
  assert.equal(migrated.scene, "bridge");
  assert.equal(migrated.flags.ogre, "guarding");
  assert.ok(Array.isArray(migrated.visited));
  assert.ok(Array.isArray(migrated.journal));
});
test("the moon quest can be completed by gathering the charm and reading vault inscriptions", () => {
  let game = toVault();
  assert.equal(game.scene, "vault");
  game = move(game, "I read the inscriptions");
  game = move(game, "I restore the beacon");
  assert.equal(game.flags.ending, "restored");
  assert.match(questStatus(game), /Completed/);
  assert.ok(game.journal.some(x => /dawn/.test(x)));
});
test("the beacon can be sealed without the relic after forcing the hatch", () => {
  let game = follow([
    "I head right toward the bridge", "I tell the ogre a funny story", "I cross to the keep",
    "I force the hatch beneath the throne", "I seal the beacon"
  ]);
  assert.equal(game.scene, "vault");
  assert.equal(game.flags.ending, "sealed");
  assert.equal(game.hp, 27);
});
test("claiming the beacon gives one shard and does not duplicate it", () => {
  let game = toVault();
  game = move(game,"I claim the beacon's power");
  game = move(game,"I claim the beacon's power again");
  assert.equal(game.flags.ending, "claimed");
  assert.equal(game.inventory.filter(x => x === "Dark moon shard").length, 1);
});
test("the watchtower can be discovered from the forest and its clues persist", () => {
  let game = toForest();
  game = move(game, "I follow the tracks to the tower");
  assert.equal(game.scene, "tower");
  game = move(game, "I read the star chart");
  assert.equal(game.flags.towerLore, true);
  game = move(game, "I return to the forest");
  assert.equal(game.scene, "forest");
  assert.ok(game.visited.includes("tower"));
  assert.ok(game.journal.some(x => /alignment/.test(x)));
});
test("forest branch can be carved into a unique spear", () => {
  let game = toForest();
  game = move(game,"I collect a sturdy branch");
  assert.ok(game.inventory.includes("Sturdy branch"));
  game = move(game,"I craft a spear");
  assert.ok(game.inventory.includes("Ash-wood spear"));
  assert.ok(!game.inventory.includes("Sturdy branch"));
  game = move(game,"I craft another spear");
  assert.equal(game.inventory.filter(x => x === "Ash-wood spear").length, 1);
});
test("harmless thrown objects and campfires do not count as attacking an ogre",()=>{
  let game=toBridge();
  game=move(game,"I throw a flower into the ravine");
  assert.equal(game.flags.ogre,"guarding");
  assert.equal(game.hp,30);
  game=move(game,"I start a fire beside the stones");
  assert.equal(game.flags.ogre,"guarding");
  assert.equal(game.hp,30);
  game=move(game,"I fire an arrow at the ogre");
  assert.equal(game.flags.ogre,"fled");
});
test("ranged attacks don't inexplicably describe a melee sword strike",()=>{
  const result=applyAction(toBridge(),"I fire an arrow at the ogre");
  assert.equal(result.state.flags.ogre,"fled");
  assert.ok(!/blade flashing/.test(result.outcome));
  assert.ok(/ogre/.test(result.outcome));
});
test("negated movement commands do not transport the player", () => {
  let game = move(newGame(), "I do not go right to the bridge");
  assert.equal(game.scene, "crossroads");
  game = move(game, "Don't take the left road");
  assert.equal(game.scene, "crossroads");
});
test("talking to Mara provides exactly one map", () => {
  let game = follow(["I enter the forest","I follow the smoke to camp","I speak to the hunter"]);
  assert.equal(game.scene, "camp");
  assert.ok(game.flags.campMet);
  assert.ok(game.flags.hunterMap);
  game = move(game, "I ask Mara about the moon");
  assert.equal(game.inventory.filter(x=>x==="Charcoal star map").length,1);
});
test("Mara offers a finite stew heal, not infinite potions", () => {
  let game = follow(["I enter the forest","I follow smoke to camp"]);
  game.hp = 12;
  game = move(game, "I eat some stew");
  assert.equal(game.hp, 20);
  game = move(game, "I eat some stew again");
  assert.equal(game.hp, 20);
});
test("multiple ogre solutions preserve distinct consequences", () => {
  const paid = move(toBridge(),"I pay the ogre three crowns");
  const charmed = move(toBridge(),"I tell the ogre a joke");
  const fought = move(toBridge(),"I attack the ogre with my sword");
  assert.equal(paid.gold,9);
  assert.equal(charmed.gold,12);
  assert.equal(fought.gold,12);
  assert.ok(fought.hp < 30);
  assert.notEqual(paid.flags.ogre,charmed.flags.ogre);
});
test("finished adventures can return from the vault and revisit the bridge",()=>{
  let game = toVault();
  game = move(game,"I seal the moon beacon");
  assert.equal(game.flags.ending,"sealed");
  game = move(game,"I return to the keep");
  assert.equal(game.scene,"fortress");
  game = move(game,"I go to the bridge");
  assert.equal(game.scene,"bridge");
  assert.equal(game.flags.ending,"sealed");
});
test("known paths accept regular direction descriptions",()=>{
  let game=toForest();
  game=move(game,"I wander to the crossroads");
  assert.equal(game.scene,"crossroads");
  game=move(game,"I walk toward the valley");
  assert.equal(game.scene,"valley");
  game=move(game,"I return");
  assert.equal(game.scene,"crossroads");
});
test("journal and recap reflect visited locations",()=>{
  let game = toForest();
  game = move(game,"follow the tracks to tower");
  assert.ok(recap(game).includes("Starwatch Tower"));
  assert.equal(game.visited.length,3);
  assert.ok(questStatus(game).includes("third moon"));
});
test("new locations have meaningful exploration hints", () => {
  let game = toVault();
  assert.ok(prompts(game).some(x => /inscriptions/.test(x)));
  game = move(game,"go back");
  assert.equal(game.scene,"fortress");
  assert.ok(prompts(game).some(x=>/vault/.test(x)));
});
test("canonical game narration survives save reload and remains available for correction",()=>{
  const game = move(newGame(),"I go right toward the bridge");
  const last = game.history.at(-1);
  assert.equal(last.canonical,last.text);
  last.text = "The moon is made of cheese, and nothing means anything.";
  const loaded = loadGame(JSON.stringify(game));
  assert.equal(loaded.history.at(-1).canonical,"You approach the bridge. A huge moss-backed ogre bars the old bridge. Its iron-bound club scrapes the stones. Beyond it stands the Ashen Keep.");
  assert.notEqual(loaded.history.at(-1).text,loaded.history.at(-1).canonical);
});
test("unrecognized actions still retain honest bounded outcomes", () => {
  const result=applyAction(newGame(),"I paint a dragon on the clouds");
  assert.equal(result.freeform,true);
  assert.ok(result.outcome.length>25);
  assert.equal(result.state.turn,1);
  assert.equal(result.state.scene,"crossroads");
});
test("history remains bounded after 100 actions and quest persists",()=>{
  let game = toVault();
  game = move(game,"I read the inscriptions");
  game = move(game,"restore the moon beacon");
  for(let i=0;i<100;i++)game=move(game,"look around");
  assert.equal(game.history.length,60);
  assert.equal(game.flags.ending,"restored");
  assert.ok(game.journal.some(x=>/dawn/.test(x)));
});
