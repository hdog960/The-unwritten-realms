// The Unwritten Realms — deterministic rules and persistent world state.
// This engine works without a network or AI. Local AI may embellish its outcomes.
export const VERSION = 1;
export const SCENES = {
  crossroads: { name: "The Hollow Road", exits: "the misty valley, the old bridge, a forest trail" },
  valley: { name: "The Bell-Mist Valley", exits: "the Hollow Road, the ruined chapel" },
  bridge: { name: "The Broken Bridge", exits: "the Hollow Road, the far-side fortress" },
  forest: { name: "The Thornwood", exits: "the Hollow Road, the hunter's camp" },
  chapel: { name: "The Sunken Chapel", exits: "the Bell-Mist Valley" },
  fortress: { name: "The Ashen Keep", exits: "the Broken Bridge" },
  camp: { name: "The Hunter's Camp", exits: "the Thornwood" }
};
const opening = "The forest falls unnaturally quiet as you reach a fork in the ancient Hollow Road. To the left, a path descends into mist, where a bell rings three times. To the right, a crumbling bridge leads toward a ruined fortress. A narrow woodland trail disappears between black pines. Behind you, something large snaps a branch.\n\nWhat do you do?";
const has = (s, pattern) => pattern.test(s);
const choice = (s, i) => s.split(" ").filter(Boolean)[i % Math.max(1, s.split(" ").filter(Boolean).length)] || "shadow";
export function newGame() {
  return { version: VERSION, turn: 0, scene: "crossroads", hp: 30, maxHp: 30, gold: 12,
    inventory: ["Rusty sword", "Travel cloak", "Dried rations"],
    flags: { ogre: "guarding", chapelRelic: false, campMet: false, bellHeard: false },
    history: [{ role: "narrator", text: opening }] };
}
export function loadGame(raw) {
  try {
    const s = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!s || s.version !== VERSION || !SCENES[s.scene] || !Array.isArray(s.history) ||
        !Array.isArray(s.inventory) || !Number.isFinite(s.hp) || !Number.isFinite(s.gold) ||
        !Number.isInteger(s.turn) || s.turn < 0 || !s.flags ||
        s.history.some(h => !["player","narrator"].includes(h.role) || typeof h.text !== "string")) return null;
    s.maxHp = 30;
    s.hp = Math.max(0, Math.min(30, s.hp));
    s.gold = Math.max(0, Math.min(9999, s.gold));
    s.history = s.history.slice(-60).map(h => ({ role: h.role, text: h.text.slice(0, 1200) }));
    s.inventory = s.inventory.filter(v => typeof v === "string").slice(0, 30);
    return s;
  } catch { return null; }
}
function location(s) { return SCENES[s.scene]?.name || SCENES.crossroads.name; }
function go(s, scene, description) { s.scene = scene; return description; }
function arriving(s) {
  switch (s.scene) {
    case "crossroads": return "The Hollow Road waits beneath dripping boughs. Mist curls left into the valley; a broken bridge lies right; black pines stand ahead.";
    case "valley": return "Cold mist slides over a valley of pale stones. A bell tolls from a half-sunken chapel. Something moves in the reeds.";
    case "bridge": return s.flags.ogre === "guarding" ? "A huge moss-backed ogre bars the old bridge. Its iron-bound club scrapes the stones. Beyond it stands the Ashen Keep." : "The broken bridge spans a roaring ravine. The road to the Ashen Keep lies open.";
    case "forest": return "The Thornwood smells of rain and pine sap. Faint smoke rises from a hunter's camp, and strange tracks cross the path.";
    case "chapel": return "Water laps against the chapel pews. A silver reliquary glitters beneath a collapsed altar; its door hangs open.";
    case "fortress": return "A ruined throne room opens beneath cracked banners. Pale light leaks from a staircase spiraling into the dark.";
    case "camp": return "A wary hunter crouches by the fire, sharpening a knife. A pot of stew bubbles among bundles of herbs.";
  }
}
export function prompts(s) {
  return ({
    crossroads: ["Follow the bell", "Approach the bridge", "Investigate the noise"],
    valley: ["Enter the chapel", "Search the reeds", "Return to the road"],
    bridge: s.flags.ogre === "guarding" ? ["Talk to the ogre", "Sneak past the ogre", "Shoot the chain above it"] : ["Cross toward the keep", "Inspect the ravine", "Return to the road"],
    forest: ["Follow the smoke", "Study the tracks", "Climb a tree"],
    chapel: ["Examine the altar", "Take the relic", "Leave the chapel"],
    fortress: ["Search the throne", "Explore the stairs", "Return to the bridge"],
    camp: ["Speak to the hunter", "Rest by the fire", "Return to the forest"]
  })[s.scene] || ["Look around"];
}
export function applyAction(previous, input) {
  const raw = String(input || "").trim().slice(0, 400);
  if (!raw) return null;
  const s = loadGame(previous);
  if (!s) throw new Error("Invalid game state");
  const t = raw.toLowerCase();
  const prior = s.scene;
  s.turn++;
  let outcome = "";
  let freeform = false;
  const back = has(t, /\b(back|return|leave|retreat|go home|turn around)\b/);
  const movement = has(t, /\b(go|walk|head|travel|move|follow|approach|cross|enter|take the path|explore|run|climb|visit)\b/);
  const gaze = has(t, /\b(look|inspect|search|examine|study|listen|observe|investigate|check|scan)\b/);
  const fight = has(t, /\b(attack|fight|strike|stab|slash|shoot|fire|swing|kill|hit|charge|throw|lunge)\b/);
  const talk = has(t, /\b(talk|speak|ask|say|tell|negotiate|bargain|bribe|pay|offer|greet)\b/);
  const sneak = has(t, /\b(sneak|hide|creep|slip|distract|duck|crawl)\b/);
  const rest = has(t, /\b(rest|sleep|heal|eat|bandage)\b/);
  if (has(t, /\b(inventory|backpack|equipment|my items|bag)\b/)) {
    outcome = "You check your pack: " + s.inventory.join(", ") + ". You carry " + s.gold + " crowns.";
  } else if (has(t, /\b(status|health|hit points|my stats)\b/)) {
    outcome = "You steady your breathing. Health: " + s.hp + "/" + s.maxHp + ". Crowns: " + s.gold + ". Location: " + location(s) + ".";
  } else if (back) {
    const parent = { valley: "crossroads", bridge: "crossroads", forest: "crossroads", chapel: "valley", fortress: "bridge", camp: "forest" };
    outcome = s.scene === "crossroads" ? "You glance back down the dark road you came from. Its tracks have already vanished into rain." :
      go(s, parent[s.scene], "You retrace your steps. " + arriving({ ...s, scene: parent[s.scene] }));
  } else if (s.scene === "crossroads" && (has(t, /\b(left|valley|bell|mist)\b/) || (movement && has(t, /\b(downhill)\b/)))) {
    outcome = go(s, "valley", "You descend the left-hand trail. " + arriving({ ...s, scene: "valley" }));
  } else if (s.scene === "crossroads" && has(t, /\b(right|bridge|keep|fortress|ogre)\b/)) {
    outcome = go(s, "bridge", "You approach the bridge. " + arriving({ ...s, scene: "bridge" }));
  } else if (s.scene === "crossroads" && has(t, /\b(forest|woods|pines|trail|trees|straight|ahead)\b/)) {
    outcome = go(s, "forest", "You follow the narrow woodland trail. " + arriving({ ...s, scene: "forest" }));
  } else if (s.scene === "valley" && has(t, /\b(chapel|church|bell tower|bell)\b/) && (movement || has(t, /\b(enter)\b/))) {
    outcome = go(s, "chapel", "You push through the chapel's broken doorway. " + arriving({ ...s, scene: "chapel" }));
  } else if (s.scene === "forest" && has(t, /\b(camp|smoke|hunter|fire)\b/) && (movement || talk)) {
    outcome = go(s, "camp", "Following the smoke, you find a little clearing. " + arriving({ ...s, scene: "camp" }));
  } else if (s.scene === "bridge" && has(t, /\b(fortress|keep|cross|other side|far side)\b/) && movement) {
    if (s.flags.ogre === "guarding") {
      outcome = "The ogre plants its club across your way. 'TOLL,' it growls. You'll need to persuade it, pay it, fight it, or find another way around.";
    } else outcome = go(s, "fortress", "You cross the creaking stone span. " + arriving({ ...s, scene: "fortress" }));
  } else if (s.scene === "bridge" && s.flags.ogre === "guarding" && (has(t, /\b(chain|overhead|above|support|rope)\b/) && fight)) {
    s.flags.ogre = "fled";
    outcome = "Your shot strikes the rusted chain. A slab of masonry crashes onto the bridge, scattering sparks. The ogre bellows, drops its club, and flees down the ravine. The way is clear.";
  } else if (s.scene === "bridge" && s.flags.ogre === "guarding" && talk) {
    if (has(t, /\b(pay|bribe|coin|gold|crowns|toll|offer)\b/) && s.gold >= 3) {
      s.gold -= 3; s.flags.ogre = "paid";
      outcome = "You toss three crowns onto the stones. The ogre counts them with an enormous finger, then steps aside. 'GOOD SMALL PERSON.' The bridge is yours.";
    } else {
      outcome = "The ogre squints at you. 'THREE SHINY CROWNS OR GOOD STORY,' it says. It seems willing to talk, though its club remains ready.";
      if (has(t, /\b(story|joke|riddle|flatter|compliment)\b/)) { s.flags.ogre = "charmed"; outcome = "Your words catch the ogre by surprise. It laughs so hard the bridge shakes, then waves you through. 'FUNNY SMALL PERSON.'"; }
    }
  } else if (s.scene === "bridge" && s.flags.ogre === "guarding" && sneak) {
    s.flags.ogre = "evaded";
    outcome = "You slip behind a fallen pillar while the ogre scratches its head. Inch by inch you edge past. When it finally looks down, you are safely on the far side.";
  } else if (s.scene === "bridge" && s.flags.ogre === "guarding" && fight) {
    const damage = 4 + (s.turn % 4);
    s.hp = Math.max(1, s.hp - damage);
    s.flags.ogre = "fled";
    outcome = "You rush the ogre, blade flashing in the rain. Your strike grazes its arm, but its wild swing bruises you for " + damage + " damage. Startled by your ferocity, it retreats into the ravine. The bridge is open.";
  } else if (s.scene === "chapel" && has(t, /\b(relic|reliquary|altar|silver|treasure|amulet)\b/) && has(t, /\b(take|grab|pick|collect|steal|loot|open)\b/)) {
    if (s.flags.chapelRelic) outcome = "The reliquary stands empty. You already secured its silver moon charm.";
    else { s.flags.chapelRelic = true; s.inventory.push("Silver moon charm"); outcome = "You lift a silver moon charm from the altar. It is cold as winter water. Somewhere high above, the tolling bell falls silent. The charm is now in your pack."; }
  } else if (s.scene === "camp" && talk) {
    s.flags.campMet = true;
    outcome = "The hunter studies you by firelight. 'The keep has been empty for a century,' she says. 'So why have its windows begun to glow?' She offers you a bowl of stew.";
  } else if (s.scene === "valley" && has(t, /\b(reeds|water|marsh|pond|pool|mud)\b/)) {
    outcome = "You part the reeds and uncover three old crowns in a cracked clay bowl. The mist briefly forms the shape of a woman before drifting apart.";
    if (!s.flags.reedsSearched) { s.gold += 3; s.flags.reedsSearched = true; }
    else outcome = "You search the reeds again, but find only wet stones and the empty clay bowl.";
  } else if (s.scene === "fortress" && (gaze || movement)) {
    outcome = "A cold draft sighs beneath the throne. On its arm is a carved message: 'THE THIRD MOON REMEMBERS.' A locked iron hatch waits below the stairs.";
  } else if (s.scene === "camp" && has(t, /\b(stew|food|eat|drink)\b/)) {
    const healed = Math.min(8, 30 - s.hp); s.hp += healed;
    outcome = "The hunter shares her warm stew. You recover " + healed + " health. Her eyes never leave the dark treeline.";
  } else if (s.scene === "chapel" && gaze) {
    outcome = "The ruined chapel smells of wet stone. A silver moon charm rests inside the altar's reliquary. The bell above has no rope, yet it still tolls.";
  } else if (s.scene === "crossroads" && has(t, /\b(branch|noise|behind|something|followed)\b/)) {
    outcome = "You turn slowly. A pair of pale eyes watches from the ferns. A deer with antlers braided in ivy steps into the road, then vanishes between the trees without a sound.";
  } else if (has(t, /\b(map|where am i|directions)\b/)) {
    outcome = "You are at " + location(s) + ". Known routes lead toward " + SCENES[s.scene].exits + ".";
  } else if (rest) {
    const gain = Math.min(5, s.maxHp - s.hp); s.hp += gain;
    outcome = gain ? "You pause, eat a little dried ration, and tend your wounds. You recover " + gain + " health. The world does not stop moving around you." : "You take a moment to catch your breath. You are already at full health.";
  } else if (gaze) {
    outcome = arriving(s) + " You notice tracks in the wet earth and the lingering sense that your choices here will matter.";
  } else {
    freeform = true;
    // Arbitrary player text is accepted, but this rules fallback cannot interpret every intention.
    const detail = choice(t.replace(/[^a-z ]/g,""), s.turn);
    outcome = "You attempt it, testing the world around you. The air shifts around your " + detail + ", and a small consequence ripples outward. " +
      arriving(s) + " Your approach is possible, but the outcome remains uncertain; try describing a more specific action.";
  }
  s.history.push({ role: "player", text: raw }, { role: "narrator", text: outcome });
  s.history = s.history.slice(-60);
  return { state: s, outcome, previousScene: prior, action: raw, freeform };
}
export function promptFor(result) {
  const s = result.state;
  const recent = s.history.slice(-8,-2).map(m => m.role + ": " + m.text).join("\n").slice(-1500);
  return [
    { role: "system", content: result.freeform ? "You are an imaginative fantasy game master. Players may type ANY action. In 65-100 words describe specifically and creatively how the world responds in second person, remembering prior actions. Stay in the current location. Do not alter tracked items, HP, gold, or travel; those are handled by the rules engine. Never mention technical limitations or rules; end with a hook." : "You are a vivid, concise fantasy RPG narrator. Rewrite the canonical outcome in second person as atmospheric fantasy prose (55-95 words). Respect ALL facts in the canonical outcome: same location, results, coins, damage, items and NPC fate. Never invent new rewards, new damage, moves, completed quests, or location transitions. Do not mention game systems, prompts, or rules. End with an intriguing detail. No Markdown headings." },
    { role: "user", content: "Location: " + location(s) + ". HP " + s.hp + "/30. Crowns " + s.gold + ". Inventory: " + s.inventory.join(", ") + ".\nRecent scene:\n" + recent + "\nPlayer typed: " + result.action + "\n" + (result.freeform ? "The rules engine has no predefined outcome. Invent a plausible in-scene consequence without changing tracked stats. Environmental context: " : "Canonical outcome to narrate exactly:\n") + result.outcome }
  ];
}
