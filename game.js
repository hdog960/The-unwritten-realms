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
  camp: { name: "The Hunter's Camp", exits: "the Thornwood" },
  tower: { name: "The Starwatch Tower", exits: "the Thornwood" },
  vault: { name: "The Moon Vault", exits: "the Ashen Keep" }
};
const opening = "The forest falls unnaturally quiet as you reach a fork in the ancient Hollow Road. To the left, a path descends into mist, where a bell rings three times. To the right, a crumbling bridge leads toward a ruined fortress. A narrow woodland trail disappears between black pines. Behind you, something large snaps a branch.\n\nWhat do you do?";
const has = (s, pattern) => pattern.test(s);
const DEFAULT_FLAGS = {
  ogre: "guarding", chapelRelic: false, campMet: false, bellHeard: false,
  reedsSearched: false, hunterMap: false, stewUsed: false, branchFound: false,
  spearCrafted: false, towerLore: false, vaultOpen: false, alignmentLearned: false,
  ending: null
};
function addItem(s, name) {
  if (!s.inventory.includes(name)) s.inventory.push(name);
}
function log(s, entry) {
  if (!s.journal.includes(entry)) s.journal.push(entry);
}
function look(s) { return arriving(s); }
export function questStatus(s) {
  if (s.flags.ending === "restored") return "Completed: You restored the moon beacon and lifted the valley's curse.";
  if (s.flags.ending === "sealed") return "Completed: You sealed away the moon beacon's dangerous power.";
  if (s.flags.ending === "claimed") return "Completed: You claimed the moon beacon. The realm may remember your choice.";
  if (s.scene === "vault") return "At the Moon Vault: discover how to control the beacon. Find its alignment and a source of moonlight.";
  if (s.flags.vaultOpen) return "The path into the Moon Vault is open. Explore beneath the Ashen Keep.";
  if (s.flags.chapelRelic) return "You have the silver moon charm. Seek the Ashen Keep and its hidden vault.";
  if (s.flags.hunterMap || s.flags.towerLore) return "You have learned about the third moon. Find the silver charm in the Sunken Chapel.";
  return "Follow the strange bell, learn why the Ashen Keep glows, and discover the secret of the third moon.";
}
export function recap(s) {
  const place = SCENES[s.scene].name;
  const discoveries = s.visited.length > 1 ? s.visited.length + " places discovered." : "Your journey has only begun.";
  const recent = s.journal.slice(-3).join(" ");
  return "You are at " + place + ". " + discoveries + " " + recent + " Next: " + questStatus(s);
}
function freeformOutcome(s, text) {
  const place = location(s);
  const details = {
    crossroads: "The misty valley, ruined bridge and pine trail remain open to you.",
    valley: "The bell sounds again near the flooded chapel.",
    bridge: "The ravine roars below, and the far road leads toward the keep.",
    forest: "Smoke rises from a camp, and tracks lead up to a watchtower.",
    chapel: "The flooded altar and silent bell still hold clues.",
    fortress: "The sealed hatch beneath the throne is worth investigating.",
    camp: "Mara watches the treeline and tends the last embers.",
    tower: "The brass star chart and signal lantern wait inside.",
    vault: "The three stone rings surround the moon beacon."
  };
  const lead = /\b(sing|shout|yell|whistle|call|hum)\b/.test(text)
    ? "You raise your voice. The sound carries through " + place + ", but no one answers."
    : /\b(dig|bury|scratch|excavate)\b/.test(text)
      ? "You scrape at the ground. The soil gives way a little, but you uncover nothing useful."
      : /\b(draw|sketch|write|paint|carve)\b/.test(text)
        ? "You mark your idea on a nearby surface. The mark remains, but it has no immediate magical effect."
        : /\b(climb|jump|leap|swing|balance)\b/.test(text)
          ? "You test your footing and look for a safe route. Nothing here leads you out of " + place + " yet."
          : /\b(attack|strike|fight|shoot|kick|punch)\b/.test(text)
            ? "You ready yourself for a fight, but there is no clear target for that move."
            : /\b(talk|ask|speak|bargain|persuade)\b/.test(text)
              ? "You speak into the quiet. There is no one close enough to answer from here."
              : /\b(go|move|wander|walk|run|sneak|travel|enter)\b/.test(text)
                ? "You look for a route, but cannot find a clear way to reach that destination from " + place + "."
                : "You try your idea, but nothing definite changes in the world yet.";
  return lead + " " + details[s.scene];
}
export function newGame() {
  return { version: VERSION, turn: 0, scene: "crossroads", hp: 30, maxHp: 30, gold: 12,
    inventory: ["Rusty sword", "Travel cloak", "Dried rations"],
    flags: { ...DEFAULT_FLAGS },
    visited: ["crossroads"],
    journal: ["You reached the Hollow Road and heard a bell from the mist."],
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
    s.history = s.history.slice(-60).map(h => ({
      role: h.role,
      text: h.text.slice(0, 1200),
      ...(typeof h.canonical === "string" ? { canonical: h.canonical.slice(0, 1200) } : {})
    }));
    s.inventory = s.inventory.filter(v => typeof v === "string").slice(0, 30);
    s.flags = { ...DEFAULT_FLAGS, ...s.flags };
    s.visited = Array.isArray(s.visited) ? [...new Set(s.visited.filter(v => SCENES[v]))].slice(0, 30) : [s.scene];
    s.journal = Array.isArray(s.journal) ? s.journal.filter(x => typeof x === "string").slice(-45) : ["Your adventure began before the journal was added."];
    return s;
  } catch { return null; }
}
function location(s) { return SCENES[s.scene]?.name || SCENES.crossroads.name; }
function go(s, scene, description) {
  s.scene = scene;
  if (!s.visited.includes(scene)) s.visited.push(scene);
  return description;
}
function arriving(s) {
  switch (s.scene) {
    case "crossroads": return "The Hollow Road waits beneath dripping boughs. Mist curls left into the valley; a broken bridge lies right; black pines stand ahead.";
    case "valley": return "Cold mist slides over a valley of pale stones. A bell tolls from a half-sunken chapel. Something moves in the reeds.";
    case "bridge": return s.flags.ogre === "guarding" ? "A huge moss-backed ogre bars the old bridge. Its iron-bound club scrapes the stones. Beyond it stands the Ashen Keep." : "The broken bridge spans a roaring ravine. The road to the Ashen Keep lies open.";
    case "forest": return "The Thornwood smells of rain and pine sap. Faint smoke rises from a hunter's camp, and strange tracks cross the path.";
    case "chapel": return "Water laps against the chapel pews. A silver reliquary glitters beneath a collapsed altar; its door hangs open.";
    case "fortress": return "A ruined throne room opens beneath cracked banners. Pale light leaks from a staircase spiraling into the dark.";
    case "camp": return "A wary hunter named Mara tends the fire. Behind her are charts of the night sky and a pot of stew.";
    case "tower": return "The Starwatch Tower rises above the pines. Inside, a brass star chart points toward an unfamiliar third moon. A signal lantern hangs beside the stair.";
    case "vault": return s.flags.ending ? "The moon beacon is quiet. You can still hear water moving beyond the sealed walls." : "Below the keep, a moonlit mechanism hangs over a black pool. Three stone rings surround its empty lens. Old instructions are carved into the wall.";
  }
}
export function prompts(s) {
  return ({
    crossroads: ["Follow the bell", "Approach the bridge", "Investigate the noise"],
    valley: ["Enter the chapel", "Search the reeds", "Return to the road"],
    bridge: s.flags.ogre === "guarding" ? ["Talk to the ogre", "Sneak past the ogre", "Shoot the chain above it"] : ["Cross toward the keep", "Inspect the ravine", "Return to the road"],
    forest: ["Follow the smoke", "Follow the tracks to the tower", "Collect a sturdy branch"],
    chapel: s.flags.chapelRelic ? ["Study the bell", "Pray at the altar", "Leave the chapel"] : ["Examine the altar", "Take the relic", "Leave the chapel"],
    fortress: ["Search the throne", "Descend to the moon vault", "Return to the bridge"],
    camp: ["Ask Mara about the third moon", "Eat some stew", "Return to the forest"],
    tower: ["Read the star chart", "Light the signal lantern", "Return to the forest"],
    vault: s.flags.ending ? ["Review what happened", "Return to the keep"] : ["Read the inscriptions", "Restore the moon beacon", "Seal the moon beacon"]
  })[s.scene] || ["Look around"];
}

function resolveSpecial(s, t, context) {
  const { movement, gaze, talk, fight, sneak } = context;
  // Negated orders must never be mistaken for positive commands.
  if (/^(?:(?:i|we)\s+)?(?:don't|do not|never|refuse to|avoid)\b/.test(t))
    return "You decide not to do that. Nothing changes. You remain at " + location(s) + ".";
  if (/\b(quest|objective|mission|journal)\b/.test(t)) return questStatus(s);
  if (/\b(recap|what happened|remind me|summari[sz]e)\b/.test(t)) return recap(s);
  if (/^(?:help|what can i do|what are my options)\??$/.test(t))
    return "You can explore, inspect objects, talk, bargain, sneak, fight, rest or use items. Describe your action in your own words. " + questStatus(s);
  if (s.scene === "crossroads" && /\b(listen|bell|hear)\b/.test(t) && !movement) {
    s.flags.bellHeard = true;
    return "You stop and listen. The bell sounds three times from the valley. The third note has a strange echo, as though another bell answers from below the earth.";
  }
  if (s.scene === "forest") {
    if (/\b(track|footprint|trail of prints|follow the tracks|watchtower|starwatch|tower)\b/.test(t) && (gaze || movement)) {
      if (movement || /\bfollow\b/.test(t)) {
        return go(s, "tower", "You follow boot prints through the trees to an old lookout tower. " + look({ ...s, scene:"tower" }));
      }
      return "The tracks belong to a lone traveler. They lead uphill to a stone watchtower above the pines.";
    }
    if (/\b(branch|stick|wood|sapling)\b/.test(t) && /\b(take|pick|gather|collect|break|grab|find)\b/.test(t)) {
      if (s.flags.branchFound) return "You've already gathered a strong branch. It is in your pack unless you turned it into a spear.";
      s.flags.branchFound = true;
      addItem(s,"Sturdy branch");
      return "You find a fallen ash branch, straight and strong. You add it to your pack. You could sharpen it into a spear.";
    }
    if (/\b(spear|weapon|sharpen)\b/.test(t) && /\b(craft|make|carve|fashion|build|sharpen)\b/.test(t)) {
      if (s.flags.spearCrafted) return "Your ash-wood spear is already finished.";
      if (!s.inventory.includes("Sturdy branch")) return "You need a straight branch before you can make a spear. Fallen wood lies along the forest trail.";
      s.inventory = s.inventory.filter(x=>x!=="Sturdy branch");
      addItem(s,"Ash-wood spear");
      s.flags.spearCrafted = true;
      return "You use the edge of your sword to sharpen the branch. You now carry an ash-wood spear.";
    }
    if (/\b(climb|scale)\b/.test(t) && /\b(tree|pine|branches)\b/.test(t))
      return "You climb an old pine. From the top, you spot smoke from a camp and a watchtower on a hill. The ruined keep glows faintly beyond the valley.";
  }
  if (s.scene === "tower") {
    if (/\b(chart|stars?|moon|telescope|inscription|writing|read|study)\b/.test(t) && (gaze || /\b(read|study|inspect)\b/.test(t))) {
      s.flags.towerLore = true;
      return "You read the tower's star chart. The third moon is marked with a silver ring, and a note says: 'Moonlight opens what iron cannot.' You copy the alignment into your journal.";
    }
    if (/\b(lantern|beacon|signal|fire|light)\b/.test(t) && /\b(light|ignite|signal|kindle|start)\b/.test(t)) {
      if (s.flags.towerSignal) return "The lantern already burns. Its signal shines over the forest.";
      s.flags.towerSignal = true;
      return "You ignite the tower's old signal lantern. Gold light flashes through the treetops. Far away, a matching light answers from the Ashen Keep.";
    }
  }
  if (s.scene === "camp") {
    if (/\b(stew|soup|food|eat|drink|hungry)\b/.test(t) && /\b(eat|drink|taste|ask|take|have|share)\b/.test(t)) {
      if (s.flags.stewUsed) return "Mara smiles apologetically. The pot is empty, but you're welcome to stay by the fire.";
      s.flags.stewUsed = true;
      const healed = Math.min(8, s.maxHp - s.hp);
      s.hp += healed;
      return "Mara serves a bowl of thick stew. You recover " + healed + " health. She says the old keep's lights began glowing when the bell started ringing.";
    }
    if (talk || /\b(mara|hunter|map|moon|keep|rumor)\b/.test(t)) {
      s.flags.campMet = true;
      if (!s.flags.hunterMap) {
        s.flags.hunterMap = true;
        addItem(s,"Charcoal star map");
        return "Mara welcomes you to her fire. She shows you a charcoal map of the keep, the chapel, and a tower. 'The third moon is a lock, not a curse,' she says. She gives you a copy of her map.";
      }
      return "Mara points to your map. 'The chapel holds a silver charm. The tower has the alignment. Both can help you understand the machine beneath the keep.'";
    }
  }
  if (s.scene === "chapel") {
    if (/\b(pray|kneel|whisper|sing|hymn)\b/.test(t)) {
      s.flags.bellHeard = true;
      return "You kneel near the flooded altar. The bell tolls once, then falls silent. For a moment, moonlight gathers on a silver charm in the reliquary.";
    }
    if (/\b(bell|tower)\b/.test(t) && gaze) {
      s.flags.bellHeard = true;
      return "There is no bell rope. Old letters carved into the stone read: 'When the third moon shines, the lost gate wakes.'";
    }
  }
  if (s.scene === "bridge" && s.flags.ogre === "guarding") {
    if (/\b(stone|rock|pebble)\b/.test(t) && /\b(throw|toss|hurl|lob)\b/.test(t)) {
      s.flags.ogreDistracted = true;
      return "You throw a stone into the ravine. The ogre turns toward the splash, leaving a momentary gap beside the broken parapet. You could slip past it.";
    }
    if (/\b(story|joke|riddle|sing|song)\b/.test(t) && /\b(tell|share|sing|recite|perform)\b/.test(t)) {
      s.flags.ogre = "charmed";
      return "You tell the ogre a ridiculous tale. It laughs until the bridge trembles and waves you through without asking for coins.";
    }
  }
  if (s.scene === "fortress") {
    if (/\b(stairs?|hatch|below|downstairs|vault|undercroft|cellar)\b/.test(t) &&
        (movement || /\b(open|unlock|force|break|kick|descend|push)\b/.test(t))) {
      if (s.flags.vaultOpen || s.flags.chapelRelic) {
        s.flags.vaultOpen = true;
        return go(s,"vault","You fit the silver charm into the hatch's moon-shaped keyhole. Its lock releases. You descend beneath the keep. " + look({ ...s,scene:"vault" }));
      }
      if (/\b(force|break|kick|smash)\b/.test(t)) {
        s.hp = Math.max(1,s.hp-3);
        s.flags.vaultOpen = true;
        return go(s,"vault","You break the old lock with your sword hilt, bruising your shoulder for 3 damage. A stairway leads down into the Moon Vault. " + look({ ...s,scene:"vault" }));
      }
      return "You find a sealed hatch beneath the throne. Its lock is shaped like a crescent moon. A silver charm might open it, or you could force it at some risk.";
    }
    if (/\b(throne|writing|message|inscription|banner)\b/.test(t) && gaze) {
      return "You brush dust from the throne. The carved message reads: 'THE THIRD MOON REMEMBERS.' Beneath the throne sits a locked hatch.";
    }
  }
  if (s.scene === "vault") {
    if (s.flags.ending) return "The moon beacon's fate is decided. " + questStatus(s) + " You can return to the keep or continue exploring.";
    if (/\b(inscription|read|study|examine|inspect|runes?|rings?|alignment|symbols?|walls?)\b/.test(t) && (gaze || /\b(read|study|examine|inspect)\b/.test(t))) {
      s.flags.alignmentLearned = true;
      return "The wall explains the mechanism: three rings must face the third moon. The silver charm can focus its light. You learn the alignment and can now try to restore or seal the beacon.";
    }
    if (/\b(seal|shut down|close|silence|contain|disable)\b/.test(t)) {
      s.flags.ending = "sealed";
      return "You close the three stone rings around the beacon. Its glow fades, and the tremor beneath the valley stops. The strange bell falls silent. You have sealed the power away.";
    }
    if (/\b(claim|steal|take|grab|keep|destroy|shatter)\b/.test(t) && /\b(beacon|power|moonlight|light|flame|core)\b/.test(t)) {
      s.flags.ending = "claimed";
      addItem(s,"Dark moon shard");
      return "You pull a shard from the beacon's heart. The entire vault falls dark. A cold star now glimmers in your hand. You keep the shard, but the bell can be heard far across the land.";
    }
    if (/\b(restore|light|ignite|activate|awaken|repair|fix|align|save|turn on)\b/.test(t) && /\b(beacon|moon|rings?|light|machine|device|mechanism)\b/.test(t)) {
      if (!s.flags.chapelRelic) return "The beacon has an empty lens. You need the silver moon charm from the flooded chapel to focus its light.";
      if (!s.flags.alignmentLearned && !s.flags.towerLore && !s.flags.hunterMap)
        return "The silver charm fits the lens, but the stone rings turn out of order. Read the vault's inscriptions or find an old sky chart to learn the alignment.";
      s.flags.ending = "restored";
      return "You set the silver charm into the lens and turn the rings toward the third moon. Silver light spreads through the vault. The bell stops, the black pool clears, and dawn finally reaches the valley. You restored the moon beacon.";
    }
  }
  if (/\b(hide|crouch|duck)\b/.test(t) && sneak) return "You lower yourself behind nearby cover and listen. For now, nothing notices you. " + look(s);
  if (/\b(listen|smell|touch|feel)\b/.test(t) && !movement) {
    const sensed = {
      crossroads: "Damp bark and distant rain surround you. The bell rings again, three deliberate notes.",
      valley: "The reeds rustle without wind. A cold current stirs the water beside the chapel.",
      bridge: "Water crashes in the ravine. The ogre's heavy breathing echoes through the stones.",
      forest: "Pine needles crunch underfoot. A faint scent of smoke drifts downhill.",
      chapel: "Cold water laps against the steps. The bell above has no visible rope.",
      fortress: "An icy breeze rises from beneath the throne, carrying the smell of old stone.",
      camp: "You hear a spoon tap the stew pot. Beyond the fire, the forest is quiet.",
      tower: "The brass chart clicks faintly as its gears turn toward the night sky.",
      vault: "The black pool ripples. Something inside the moonlit mechanism hums."
    };
    return sensed[s.scene];
  }
  return null;
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
  const movement = has(t, /\b(go|walk|head|travel|move|follow|approach|cross|enter|take the path|explore|run|climb|visit|sneak|creep|slip|wander|venture|stroll|hike|step|make my way)\b/);
  const gaze = has(t, /\b(look|inspect|search|examine|study|listen|observe|investigate|check|scan)\b/);
  const fight = has(t, /\b(attack|fight|strike|stab|slash|shoot|fire|swing|kill|hit|charge|throw|lunge)\b/);
  const talk = has(t, /\b(talk|speak|ask|say|tell|negotiate|bargain|bribe|pay|offer|greet)\b/);
  const sneak = has(t, /\b(sneak|hide|creep|slip|distract|duck|crawl)\b/);
  const rest = has(t, /\b(rest|sleep|heal|eat|bandage)\b/);
  const special = resolveSpecial(s,t,{ movement,gaze,talk,fight,sneak,rest });
  if (special !== null) {
    outcome = special;
  } else if (has(t, /\b(inventory|backpack|equipment|my items|bag)\b/)) {
    outcome = "You check your pack: " + s.inventory.join(", ") + ". You carry " + s.gold + " crowns.";
  } else if (has(t, /\b(status|health|hit points|my stats)\b/)) {
    outcome = "You steady your breathing. Health: " + s.hp + "/" + s.maxHp + ". Crowns: " + s.gold + ". Location: " + location(s) + ".";
  } else if (back) {
    const parent = { valley: "crossroads", bridge: "crossroads", forest: "crossroads", chapel: "valley", fortress: "bridge", camp: "forest", tower: "forest", vault: "fortress" };
    outcome = s.scene === "crossroads" ? "You glance back down the dark road you came from. Its tracks have already vanished into rain." :
      go(s, parent[s.scene], "You retrace your steps. " + arriving({ ...s, scene: parent[s.scene] }));
  } else if (s.scene === "crossroads" && movement && (has(t, /\b(left|valley|bell|mist)\b/) || has(t, /\b(downhill)\b/))) {
    outcome = go(s, "valley", "You descend the left-hand trail. " + arriving({ ...s, scene: "valley" }));
  } else if (s.scene === "crossroads" && movement && has(t, /\b(right|bridge|keep|fortress|ogre)\b/)) {
    outcome = go(s, "bridge", "You approach the bridge. " + arriving({ ...s, scene: "bridge" }));
  } else if (s.scene === "crossroads" && movement && has(t, /\b(forest|woods|pines|trail|trees|straight|ahead)\b/)) {
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
    // Actions outside the authored world remain honest and useful rather than random gibberish.
    outcome = freeformOutcome(s,t);
  }
  if (s.flags.chapelRelic) log(s,"You found a silver moon charm in the Sunken Chapel.");
  if (s.flags.hunterMap) log(s,"Mara shared a charcoal map of the old kingdom.");
  if (s.flags.towerLore) log(s,"You deciphered the third moon's alignment at Starwatch Tower.");
  if (s.flags.ogre !== "guarding") log(s,"You passed the ogre on the Broken Bridge.");
  if (s.flags.vaultOpen) log(s,"You opened the Moon Vault beneath the Ashen Keep.");
  if (s.flags.ending === "restored") log(s,"You restored the beacon and returned dawn to the valley.");
  if (s.flags.ending === "sealed") log(s,"You sealed the moon beacon beneath the keep.");
  if (s.flags.ending === "claimed") log(s,"You claimed a shard of the moon beacon for yourself.");
  s.history.push({ role: "player", text: raw }, { role: "narrator", text: outcome });
  s.history = s.history.slice(-60);
  return { state: s, outcome, previousScene: prior, action: raw, freeform };
}
export function promptFor(result, style = "normal") {
  const s = result.state;
  const recent = s.history.slice(-8, -2).filter(m => m.role === "narrator")
    .map(m => m.text).join(" ").slice(-450);
  if (style === "clear") {
    const rules = "You tell an adventure in simple English. Write exactly two short sentences using you or your. Say what the player does and what happens next. No poems, long words, lists, or invented rewards.";
    const action = result.action.replace(/\s+/g, " ").slice(0, 180);
    const consequence = result.freeform
      ? "The attempt has no recorded change to the player's items, location or health. Give a small plausible reaction in place."
      : result.outcome.slice(0, 380);
    return [
      { role: "system", content: rules },
      { role: "user", content: "Location: " + location(s) + "\nAction: " + action + "\nResult: " + consequence + "\nAnswer in two simple sentences:" }
    ];
  }
  const guide = "You narrate a fantasy text RPG. Reply in plain English using 2 or 3 short, complete sentences in second person (you/your). Describe concrete actions and their immediate consequences. Avoid flowery language, metaphors, repetition, lists, dialogue tags, and filler. Stay in the current scene. No markdown.";
  const constraint = "Never change health, crowns, items, creatures defeated, or location unless the confirmed outcome says so.";
  const instruction = result.freeform
    ? "The rules do not recognize this action. Describe a believable small response to the attempt in this scene. Do not award items, wounds, victories or travel. Players may type ANY action."
    : "Retell the confirmed outcome in clearer, simpler language. Do not alter any of its facts or results.";
  return [
    { role: "system", content: guide + " " + constraint },
    { role: "user", content:
      "Place: " + location(s) + ". Nearby: " + arriving(s) +
      (recent ? "\nEarlier: " + recent : "") +
      "\nPlayer action: " + result.action +
      "\n" + instruction +
      "\nConfirmed outcome: " + result.outcome +
      "\nNarrate clearly:" }
  ];
}
