import { newGame, loadGame, applyAction, promptFor, prompts, SCENES } from "./game.js";

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
  ready = false;
  loading = false;
  if (worker) { worker.terminate(); worker = null; }
  for (const pending of awaiting.values()) pending.reject(new Error("AI disabled"));
  awaiting.clear();
  el("mode-label").textContent = "Story engine";
  el("load-ai").hidden = false;
  el("load-ai").disabled = false;
  el("disable-ai").hidden = true;
  setAIStatus(message);
}
function startAI() {
  if (loading || ready) return;
  if (!("Worker" in window)) {
    setAIStatus("This browser cannot run the local AI worker. The story engine remains playable.", true);
    return;
  }
  if (!("gpu" in navigator)) {
    setAIStatus("WebGPU is unavailable in this browser. Local AI needs recent Safari/iOS; the story engine remains fully playable.", true);
    return;
  }
  loading = true;
  el("load-ai").disabled = true;
  el("disable-ai").hidden = false;
  setAIStatus("Preparing local AI… this may download 118 MB of model weights plus supporting files.");
  try {
    worker = new Worker("./ai-worker.js", { type: "module" });
    worker.onerror = event => {
      console.error("Local AI worker failed", event.message);
      disableAI("Local AI could not start on this browser. The regular game is still playable.");
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        const part = data.percent != null ? " (" + Math.round(data.percent) + "%)" : "";
        setAIStatus("Downloading / preparing: " + (data.file || "model") + part);
      } else if (data.type === "ready") {
        loading = false;
        ready = true;
        el("load-ai").hidden = true;
        el("load-ai").disabled = false;
        el("mode-label").textContent = "Local AI active";
        setAIStatus("Local AI loaded in this browser. Your next action will receive an AI-written narration.");
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
    worker.postMessage({ type: "init" });
  } catch (err) {
    disableAI("Could not create local AI worker: " + err.message);
  }
}
function generate(messages) {
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
    worker.postMessage({ type: "generate", id, messages });
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
      const narration = await generate(promptFor(result));
      if (typeof narration === "string" && narration.trim().length >= 25) {
        const last = state.history[state.history.length - 1];
        if (last && last.role === "narrator") last.text = narration.trim().slice(0, 1500);
        persist();
        setAIStatus("Local AI is active. Your story stays on this device.");
      } else setAIStatus("AI returned no usable narrative; showing the reliable story-engine outcome.");
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
el("load-ai").addEventListener("click", startAI);
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
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
