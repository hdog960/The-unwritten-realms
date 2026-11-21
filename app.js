import { newGame, loadGame, applyAction, promptFor, prompts, SCENES, questStatus, recap } from "./game.js";
import { cleanNarration } from "./narration.js";
import { checkModelSupport, resolveAIChoice } from "./ai-safety.js";
import {detectInterruptedAttempt,beginAttempt,updateAttempt,endAttempt} from "./ai-attempt.js";

const STORE = "unwritten-realms-save-v1";
const UNDO = "unwritten-realms-undo-v1";
const READABLE = "unwritten-realms-readable-v1";
function setUndo(s) { try { localStorage.setItem(UNDO, JSON.stringify(s)); } catch {} }
function getUndo() { try { return loadGame(localStorage.getItem(UNDO)); } catch { return null; } }
function clearUndo() { try { localStorage.removeItem(UNDO); } catch {} }
function saveMessage(message, warning = false) {
  el("save-status").textContent = message;
  el("save-status").classList.toggle("warning", warning);
}
const el = id => document.getElementById(id);
let state;
try { state = loadGame(localStorage.getItem(STORE)) || newGame(); }
catch { state = newGame(); }
let worker = null;
let ready = false;
let loading = false;
let busy = false;
let requestId = 0;
let activeModel = "light";
let activeStyle = "normal";
// A Home Screen app may report a desktop-like user agent; compact/standalone
// display is safer for choosing the default button than browser identity alone.
const mobileExperience = navigator.standalone === true ||
  window.matchMedia("(max-width: 640px)").matches ||
  window.matchMedia("(pointer: coarse)").matches;
const aiDevice = {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  mobileExperience
};
const MOBILE_AI_BUILD = "v0.6.7";
let mobileAttempt = false;
let retryAllowed = true;
let activeBackend = "webgpu";
const aiAttemptStore=window.localStorage;
const baseLightLabel = "Lightweight AI · ~118 MB";
const baseClearLabel = mobileExperience ? "Clearer writing · same small AI" : "Larger AI · ~272 MB (desktop)";
function resetChoiceLabels() {
  el("load-ai").textContent = baseLightLabel;
  el("load-ai-enhanced").textContent = baseClearLabel;
  el("load-ai").setAttribute("aria-pressed", String(ready && activeStyle === "normal" && activeModel === "light"));
  el("load-ai-enhanced").setAttribute("aria-pressed", String(ready && (mobileExperience ? activeStyle === "clear" && activeModel === "light" : activeModel === "enhanced")));
  el("load-ai-mobile").textContent = ready && activeModel==="enhanced"&&activeBackend==="webllm" ? "360M GPU active" : "Try 360M GPU · experimental";
  el("load-ai-mobile").setAttribute("aria-pressed",String(ready&&activeModel==="enhanced"&&activeBackend==="webllm"));
  el("load-ai-cpu").textContent = ready&&activeModel==="enhanced"&&activeBackend==="wasm" ? "360M CPU active" : "Use 360M compatibility mode · CPU";
  el("load-ai-cpu").setAttribute("aria-pressed",String(ready&&activeModel==="enhanced"&&activeBackend==="wasm"));
  // Safari Home Screen can display a checked box without promptly firing change.
  // The button remains tappable; startAI checks consent synchronously before
  // creating any Worker or downloading model weights.
  el("load-ai-mobile").disabled = loading;
  el("load-ai-cpu").disabled = loading;
}

let loadWatchdog = null;
const LOAD_STALL_MS = 120000;
function clearLoadWatchdog() {
  if (loadWatchdog !== null) clearTimeout(loadWatchdog);
  loadWatchdog = null;
}
function armLoadWatchdog() {
  clearLoadWatchdog();
  loadWatchdog = setTimeout(() => {
    if (loading) disableAI("The AI stopped responding during loading. It has been safely turned off. Your saved adventure is unaffected.");
  }, LOAD_STALL_MS);
}

const awaiting = new Map();

function persist() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); }
  catch { el("ai-status").textContent = "Browser storage is unavailable. Use Export save to keep a backup."; }
}
function textNode(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}
function render() {
  el("hp-text").textContent = state.hp + " / " + state.maxHp;
  el("hp-fill").style.width = (100 * state.hp / state.maxHp) + "%";
  el("gold-text").textContent = state.gold;
  el("location").textContent = SCENES[state.scene].name;
  el("scene-short").textContent = state.scene === "crossroads" ? "Hollow Road" : SCENES[state.scene].name.replace(/^The /, "");
  el("turn-text").textContent = "TURN " + state.turn;
  el("chapter-label").textContent = state.flags.ending ? "Chapter I · The ending" : state.scene === "vault" ? "Chapter I · The third moon" : "Chapter I · The Hollow Road";
  const story = el("story");
  story.replaceChildren(...state.history.map(m => textNode("div", "entry " + m.role, m.text)));
  story.scrollTop = story.scrollHeight;
  const suggestions = el("suggestions");
  suggestions.replaceChildren(...prompts(state).map(phrase => {
    const button = textNode("button", "suggestion", phrase);
    button.type = "button";
    button.disabled = busy;
    button.addEventListener("click", () => takeAction(phrase));
    return button;
  }));
  el("character-info").replaceChildren(
    textNode("p", "", "Level 1 Wanderer · " + SCENES[state.scene].name),
    textNode("p", "", "Health: " + state.hp + "/" + state.maxHp + " · Crowns: " + state.gold),
    textNode("p", "", "Inventory: " + state.inventory.join(", "))
  );
  const journal = el("journal-info");
  const actions = state.history.filter(x => x.role === "player").slice(-6);
  journal.replaceChildren(
    textNode("p", "goal", questStatus(state)),
    ...state.journal.slice(-12).map(item => textNode("p", "", "✧ " + item)),
    textNode("p", "", "Recent actions:"),
    ...actions.map(item => textNode("p", "", "• " + item.text))
  );
  el("map-info").replaceChildren(
    textNode("p", "", "You have explored " + state.visited.length + " of " + Object.keys(SCENES).length + " locations."),
    ...state.visited.map(key => textNode("p", "", "✧ " + SCENES[key].name + " — " + SCENES[key].exits))
  );
  el("undo-last").disabled = busy || !getUndo();
  const lastNarrator = [...state.history].reverse().find(item => item.role === "narrator");
  el("clear-last").disabled = busy || !lastNarrator?.canonical || lastNarrator.text === lastNarrator.canonical;
}
function setBusy(value) {
  busy = value;
  el("submit").disabled = value;
  el("submit").textContent = value ? "The realm answers…" : "Take action →";
  el("action").disabled = value;
  render();
}
function setAIStatus(message, isWarning = false) {
  el("ai-status").textContent = message;
  el("ai-status").classList.toggle("warning", isWarning);
  // In a tall iPhone panel the old status was out of sight. Mirror every
  // experimental attempt next to the button that was tapped.
  if (mobileAttempt) {
    const inline = el("mobile-ai-status");
    inline.textContent = MOBILE_AI_BUILD + " · " + message;
    inline.classList.toggle("warning", isWarning);
  }
}
function disableAI(message = "AI off. The rule-based story engine is ready to play.") {
  const wasLoading = loading;
  clearLoadWatchdog();
  ready = false;
  loading = false;
  if (worker) { worker.terminate(); worker = null; }
  if(mobileAttempt)endAttempt(aiAttemptStore,false);
  if(mobileAttempt&&activeModel==="enhanced"&&wasLoading){retryAllowed=false;el("retry-360m").hidden=false;}
  for (const pending of awaiting.values()) pending.reject(new Error("AI disabled"));
  awaiting.clear();
  activeStyle = "normal";
  el("mode-label").textContent = "Story engine";
  for (const id of ["load-ai", "load-ai-enhanced"]) {
    el(id).hidden = false;
    el(id).disabled = false;
  }
  el("disable-ai").hidden = true;
  resetChoiceLabels();
  setAIStatus(message);
}
function startAI(choice = "light") {
  if (choice === "mobile-enhanced" || choice==="mobile-cpu") {
    mobileAttempt = true;
    setAIStatus(choice==="mobile-cpu"?"360M CPU selected. No WebGPU required…":"360M GPU selected. Checking consent and WebGPU…");
  } else {
    mobileAttempt = false;
    el("mobile-ai-status").textContent = MOBILE_AI_BUILD + " · Experimental AI not started.";
  }
  // The only route to 360M is an explicitly acknowledged tap, independent
  // of whether iPhone Home Screen Safari reports a recognisable user agent.
  if ((choice === "mobile-enhanced" || choice==="mobile-cpu") && !el("mobile-ai-consent").checked) {
    setAIStatus("Acknowledge the experimental 360M warning before loading the larger AI.", true);
    return;
  }
  if((choice==="mobile-enhanced"||choice==="mobile-cpu")&&!retryAllowed){
    setAIStatus("SAFETY-01: A previous 360M attempt was interrupted or failed. Use the explicit one-attempt retry control first. The small AI still works.",true);
    return;
  }
  const selected = resolveAIChoice(choice, aiDevice);
  if (loading) {
    setAIStatus("AI is already loading. You can cancel with Turn AI off.");
    return;
  }
  if (ready) {
    if (activeModel === selected.model) {
      activeStyle = selected.style;
      resetChoiceLabels();
      el("mode-label").textContent = selected.label;
      setAIStatus(selected.style === "clear"
        ? "Clear writing enabled. It uses the same lightweight AI with shorter, simpler replies. Try your next action. This is not a larger model."
        : selected.model === "enhanced" ? "Experimental larger AI (360M) is active."
        : "Lightweight AI narration enabled. Try your next action.");
    } else {
      setAIStatus("To change AI model, tap Turn AI off first. Your adventure will stay saved.", true);
    }
    return;
  }
  const model = selected.model;
  const mobileExperimental = (choice === "mobile-enhanced" || choice==="mobile-cpu") && el("mobile-ai-consent").checked;
  const mobileCpu=choice==="mobile-cpu";
  const requestedBackend=mobileCpu?"wasm":choice==="mobile-enhanced"?"webllm":"webgpu";
  const support = checkModelSupport(model, aiDevice, { experimentalMobile: mobileExperimental });
  if (!support.allowed) {
    setAIStatus(support.message, true);
    return;
  }
  if (!("Worker" in window)) {
    setAIStatus("WORKER-01: Web Workers are unavailable in this Home Screen app. The story engine remains playable.", true);
    return;
  }
  if (!navigator.gpu && !mobileCpu) {
    setAIStatus("GPU-01: WebGPU is unavailable to this Home Screen app (navigator.gpu missing). The button responded but 360M cannot load here. Try the same game URL in Safari for comparison. Do not delete your shortcut.", true);
    return;
  }
  loading = true;
  if(mobileExperimental){
    beginAttempt(aiAttemptStore,mobileCpu?"starting CPU WASM Worker":"starting GPU Worker");
    retryAllowed=false;
  }
  armLoadWatchdog();
  activeModel = model === "enhanced" ? "enhanced" : "light";
  activeStyle = selected.style;
  activeBackend=requestedBackend;
  el("load-ai").disabled = true;
  el("load-ai-enhanced").disabled = true;
  el("load-ai-mobile").disabled = true;
  el("load-ai-cpu").disabled = true;
  const loadingButton = choice === "mobile-enhanced" ? el("load-ai-mobile") : mobileCpu ? el("load-ai-cpu") : choice === "clear" ? el("load-ai-enhanced") : el("load-ai");
  loadingButton.textContent = mobileCpu?"Starting 360M CPU…":activeModel === "enhanced" ? "Checking WebGPU…" : "Loading AI…";
  el("disable-ai").hidden = false;
  setAIStatus(mobileCpu?"360M CPU compatibility starting without WebGPU. Loading may be slower." : activeModel === "enhanced" ? "360M GPU selected. Checking WebGPU before any download." : "Starting small local AI (~118 MB of weights). Clear-writing mode keeps this same model. First download may take time.");
  try {
    worker = new Worker("./ai-worker.js?v=067", { type: "module" });
    const activeWorker = worker;
    worker.onmessageerror = () => { if (worker === activeWorker) disableAI("WORKER-02: AI worker message failed. Your story engine still works."); };
    worker.onerror = event => {
      if (worker !== activeWorker) return;
      console.error("Local AI worker failed", event.message);
      disableAI("WORKER-03: Local AI worker failed: " + String(event?.message || "module failed").slice(0,120) + ". The story engine still works.");
    };
    worker.onmessage = ({ data }) => {
      if (worker !== activeWorker || !data) return;
      if (data.type === "stage") {
        armLoadWatchdog();
        if(mobileExperimental)updateAttempt(aiAttemptStore,data.message||"loading");
        setAIStatus("360M · " + String(data.message || "Preparing…").slice(0,150));
        if (activeModel === "enhanced") loadingButton.textContent = String(data.button || "Preparing 360M…").slice(0,45);
      } else if (data.type === "progress") {
        armLoadWatchdog();
        const part = data.percent != null ? " (" + Math.round(data.percent) + "%)" : "";
        setAIStatus("Downloading / preparing: " + (data.file || "model") + part);
        loadingButton.textContent = part ? "Loading AI " + part : "Loading AI…";
      } else if (data.type === "ready") {
        activeBackend=data.backend||requestedBackend;
        if(mobileExperimental){endAttempt(aiAttemptStore,true);retryAllowed=true;el("retry-360m").hidden=true;}
        clearLoadWatchdog();
        loading = false;
        ready = true;
        el("load-ai").disabled = false;
        el("load-ai-enhanced").disabled = false;
        resetChoiceLabels();
        el("mode-label").textContent = selected.label;
        setAIStatus(activeStyle === "clear"
          ? "Clear writing is ON. It uses the small local AI with shorter, simpler replies. Your next typed action will use it."
          : activeModel === "enhanced" ? (activeBackend==="wasm"?"360M CPU AI loaded! Try an action; replies may be slower.":"360M GPU loaded. Try an action.")
          : "Local AI loaded. Type an action to use it. You can switch writing style or turn it off.");
      } else if (data.type === "error") {
        if(data.id!=null&&mobileAttempt)endAttempt(aiAttemptStore,false);
        if (data.id != null && awaiting.has(data.id)) {
          awaiting.get(data.id).reject(new Error(data.message || "Generation failed"));
          awaiting.delete(data.id);
        } else {
          disableAI("MODEL-01: " + String(data.message || "model unsupported").slice(0, 190) + ". Your story engine still works.");
        }
      } else if (data.type === "generated") {
        if(mobileAttempt)endAttempt(aiAttemptStore,true);
        if (awaiting.has(data.id)) {
          awaiting.get(data.id).resolve(data.text);
          awaiting.delete(data.id);
        }
      }
    };
    worker.postMessage({ type: "init", model: activeModel, mobileExperimental, backend:requestedBackend });
  } catch (err) {
    disableAI("WORKER-04: Could not create local AI worker: " + err.message);
  }
}
function generate(messages, style = "normal") {
  return new Promise((resolve, reject) => {
    if (!ready || !worker) { reject(new Error("Local AI not loaded")); return; }
    const id = ++requestId;
    const timeout = setTimeout(() => {
      if (!awaiting.has(id)) return;
      awaiting.delete(id);
      reject(new Error("Timed out after two minutes"));
      disableAI("Local AI was too slow for this device. Using the rule-based story engine.");
    }, 120000);
    awaiting.set(id, {
      resolve: value => { clearTimeout(timeout); resolve(value); },
      reject: reason => { clearTimeout(timeout); reject(reason); }
    });
    if(mobileAttempt&&activeModel==="enhanced")beginAttempt(aiAttemptStore,"generating");
    worker.postMessage({ type: "generate", id, messages, style });
  });
}
async function takeAction(raw) {
  if (busy) return;
  const action = String(raw || "").trim();
  if (!action) return;
  let result;
  try { result = applyAction(state, action); }
  catch (error) { setAIStatus("Game action error: " + error.message, true); return; }
  if (!result) return;
  setUndo(state);
  state = result.state;
  persist();
  el("recap-result").textContent = "";
  el("story-message").textContent = "Your latest action is saved.";
  el("action").value = "";
  setBusy(true);
  if (ready) {
    setAIStatus("Your device is narrating the consequences…");
    try {
      const narration = await generate(promptFor(result, activeStyle), activeStyle);
      const readable = cleanNarration(narration);
      if (readable) {
        const last = state.history[state.history.length - 1];
        if (last && last.role === "narrator") last.text = readable;
        persist();
        setAIStatus("Narration complete. The story remains saved on your device.");
      } else setAIStatus("The AI response was unclear. Kept the original, readable game-engine result instead.", true);
    } catch (error) {
      setAIStatus("AI could not narrate this turn: " + error.message + ". Your action was saved; story-engine outcome shown.", true);
    }
  }
  setBusy(false);
  el("action").focus({ preventScroll: true });
}
el("action-form").addEventListener("submit", event => { event.preventDefault(); takeAction(el("action").value); });
el("action").addEventListener("keydown", event => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    takeAction(el("action").value);
  }
});
el("load-ai").addEventListener("click", () => startAI("light"));
el("load-ai-enhanced").addEventListener("click", () => startAI("clear"));
el("mobile-ai-consent").addEventListener("change", resetChoiceLabels);
el("retry-360m").addEventListener("click",()=>{
  retryAllowed=true;
  el("retry-360m").hidden=true;
  el("mobile-ai-consent").checked=false;
  mobileAttempt=true;
  setAIStatus("One experimental retry permitted. Check the risk box again before tapping. No model has loaded.",true);
});
el("load-ai-mobile").addEventListener("click", () => startAI("mobile-enhanced"));
el("load-ai-cpu").addEventListener("click", () => startAI("mobile-cpu"));
el("disable-ai").addEventListener("click", () => disableAI());
for (const button of document.querySelectorAll("[data-panel]")) {
  button.addEventListener("click", () => {
    const panel = button.dataset.panel;
    const showing = el("panel-" + panel).hidden;
    for (const b of document.querySelectorAll("[data-panel]")) {
      const active = b === button && showing;
      b.setAttribute("aria-pressed", String(active));
      el("panel-" + b.dataset.panel).hidden = !active;
    }
  });
}
el("restart").addEventListener("click", () => {
  if (busy) { saveMessage("Finish the current turn before restarting.", true); return; }
  if (!window.confirm("Start a new adventure? This replaces your local saved story. Export first if you want a backup.")) return;
  setUndo(state);
  state = newGame();
  persist();
  render();
  el("action").focus();
});

el("clear-last").addEventListener("click", () => {
  if (busy) { el("story-message").textContent = "Wait for the current action first."; return; }
  const last = [...state.history].reverse().find(item => item.role === "narrator");
  if (!last?.canonical) { el("story-message").textContent = "There is no verified alternate text for this reply."; return; }
  last.text = last.canonical;
  persist();
  render();
  el("story-message").textContent = "Original, verified game narration restored. Your choices are unchanged.";
});
el("undo-last").addEventListener("click", () => {
  if (busy) { saveMessage("Wait for the current turn to finish.", true); return; }
  const backup = getUndo();
  if (!backup) { saveMessage("No previous turn is available.", true); return; }
  state = backup;
  persist();
  clearUndo();
  render();
  saveMessage("Previous turn restored and saved.");
});
el("show-recap").addEventListener("click", () => {
  el("recap-result").textContent = recap(state);
});
el("text-size").addEventListener("click", () => {
  const large = !document.body.classList.contains("readable");
  document.body.classList.toggle("readable", large);
  el("text-size").textContent = large ? "Use normal text size" : "Use larger story text";
  el("text-size").setAttribute("aria-pressed", String(large));
  try { localStorage.setItem(READABLE, large ? "large" : "normal"); } catch {}
});
el("import-save").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (busy) { saveMessage("Finish your current turn before restoring.", true); return; }
  if (file.size > 1048576) { saveMessage("Save file is too large. Nothing changed.", true); return; }
  try {
    const imported = loadGame(await file.text());
    if (!imported) { saveMessage("Unrecognized or invalid save. Current game is safe.", true); return; }
    if (!window.confirm("Restore this adventure? Your current adventure will be replaced. Export it first if needed.")) return;
    setUndo(state);
    state = imported;
    persist();
    render();
    saveMessage("Adventure restored and saved.");
  } catch { saveMessage("Could not read that save. Current game is unchanged.", true); }
});

el("export-save").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unwritten-realms-save.json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});
persist();
try {
  const large = localStorage.getItem(READABLE) === "large";
  document.body.classList.toggle("readable", large);
  el("text-size").textContent = large ? "Use normal text size" : "Use larger story text";
  el("text-size").setAttribute("aria-pressed", String(large));
} catch {}
render();
window.__unwrittenBoot?.connected();
const previousAI=detectInterruptedAttempt(aiAttemptStore);
if(previousAI.wasInterrupted||previousAI.interruptions>0){
  retryAllowed=false;
  el("retry-360m").hidden=false;
  mobileAttempt=true;
  setAIStatus("SAFETY-02: Previous 360M load did not finish (last stage: "+previousAI.phase+"). Safari may have restarted due to memory, or the page may have been closed. Nothing was restarted. Small AI stays available.",true);
}else{
  el("mobile-ai-status").textContent = MOBILE_AI_BUILD + " controls connected. 360M CPU compatibility is recommended; nothing starts without a tap.";
}
// The checkbox + experimental button are always in the HTML, including
// on iPhone Home Screen apps with unexpected navigator.platform values.
resetChoiceLabels();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
