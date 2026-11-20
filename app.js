import { newGame, loadGame, applyAction, promptFor, prompts, SCENES } from "./game.js";
import { cleanNarration } from "./narration.js";
import { checkModelSupport, isAppleMobile, resolveAIChoice } from "./ai-safety.js";

const STORE = "unwritten-realms-save-v1";
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
const appleMobile = isAppleMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
const baseLightLabel = "Lightweight AI · ~118 MB";
const baseClearLabel = appleMobile ? "Clearer writing · same small AI" : "Larger AI · ~272 MB (desktop)";
function resetChoiceLabels() {
  el("load-ai").textContent = baseLightLabel;
  el("load-ai-enhanced").textContent = baseClearLabel;
  el("load-ai").setAttribute("aria-pressed", String(ready && activeStyle === "normal" && activeModel === "light"));
  el("load-ai-enhanced").setAttribute("aria-pressed", String(ready && (activeStyle === "clear" || activeModel === "enhanced")));
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
  const actions = state.history.filter(x => x.role === "player").slice(-12);
  journal.replaceChildren(
    textNode("p", "", actions.length ? "Your last " + actions.length + " actions:" : "Your story has only just begun."),
    ...actions.map((item, i) => textNode("p", "", "• " + item.text))
  );
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
}
function disableAI(message = "AI off. The rule-based story engine is ready to play.") {
  clearLoadWatchdog();
  ready = false;
  loading = false;
  if (worker) { worker.terminate(); worker = null; }
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
  const selected = resolveAIChoice(choice, navigator);
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
        : "Lightweight AI narration enabled. Try your next action.");
    } else {
      setAIStatus("To change AI model, tap Turn AI off first. Your adventure will stay saved.", true);
    }
    return;
  }
  const model = selected.model;
  const support = checkModelSupport(model, navigator);
  if (!support.allowed) {
    setAIStatus(support.message, true);
    return;
  }
  if (!("Worker" in window)) {
    setAIStatus("This browser cannot run the local AI worker. The story engine remains playable.", true);
    return;
  }
  if (!("gpu" in navigator)) {
    setAIStatus("WebGPU is unavailable in this browser. Local AI needs recent Safari/iOS; the story engine remains fully playable.", true);
    return;
  }
  loading = true;
  armLoadWatchdog();
  activeModel = model === "enhanced" ? "enhanced" : "light";
  activeStyle = selected.style;
  el("load-ai").disabled = true;
  el("load-ai-enhanced").disabled = true;
  const loadingButton = choice === "clear" ? el("load-ai-enhanced") : el("load-ai");
  loadingButton.textContent = "Loading AI…";
  el("disable-ai").hidden = false;
  setAIStatus(activeModel === "enhanced" ? "Preparing larger AI. This may take time and require significant memory." : "Starting small local AI (~118 MB of weights). Clear-writing mode keeps this same model. First download may take time.");
  try {
    worker = new Worker("./ai-worker.js", { type: "module" });
    const activeWorker = worker;
    worker.onmessageerror = () => { if (worker === activeWorker) disableAI("The local AI worker failed to send a message. The story engine is still available."); };
    worker.onerror = event => {
      if (worker !== activeWorker) return;
      console.error("Local AI worker failed", event.message);
      disableAI("Local AI could not start on this browser. The regular game is still playable.");
    };
    worker.onmessage = ({ data }) => {
      if (worker !== activeWorker || !data) return;
      if (data.type === "progress") {
        armLoadWatchdog();
        const part = data.percent != null ? " (" + Math.round(data.percent) + "%)" : "";
        setAIStatus("Downloading / preparing: " + (data.file || "model") + part);
        loadingButton.textContent = part ? "Loading AI " + part : "Loading AI…";
      } else if (data.type === "ready") {
        clearLoadWatchdog();
        loading = false;
        ready = true;
        el("load-ai").disabled = false;
        el("load-ai-enhanced").disabled = false;
        resetChoiceLabels();
        el("mode-label").textContent = selected.label;
        setAIStatus(activeStyle === "clear"
          ? "Clear writing is ON. It uses the small local AI with shorter, simpler replies. Your next typed action will use it."
          : "Local AI loaded. Type an action to use it. You can switch writing style or turn it off.");
      } else if (data.type === "error") {
        if (data.id != null && awaiting.has(data.id)) {
          awaiting.get(data.id).reject(new Error(data.message || "Generation failed"));
          awaiting.delete(data.id);
        } else {
          disableAI("Local AI failed to load: " + String(data.message || "device unsupported").slice(0, 170) + ". Story engine still works.");
        }
      } else if (data.type === "generated") {
        if (awaiting.has(data.id)) {
          awaiting.get(data.id).resolve(data.text);
          awaiting.delete(data.id);
        }
      }
    };
    worker.postMessage({ type: "init", model: activeModel });
  } catch (err) {
    disableAI("Could not create local AI worker: " + err.message);
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
  state = result.state;
  persist();
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
  if (!window.confirm("Start a new adventure? This replaces your local saved story. Export first if you want a backup.")) return;
  state = newGame();
  persist();
  render();
  el("action").focus();
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
render();
if (appleMobile) {
  el("load-ai-enhanced").textContent = baseClearLabel;
  el("model-compatibility").hidden = false;
}
resetChoiceLabels();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
