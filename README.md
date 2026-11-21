# The Unwritten Realms

**Your words. Your world. Your legend.**

A free, mobile-first, text-based fantasy RPG designed for GitHub Pages. This project is **independent of Mythwrought**.

## Play

**GitHub Pages:** https://hdog960.github.io/The-unwritten-realms/

GitHub Pages should be configured for **GitHub Actions** (the repository has an explicit deploy workflow). Changes may take a little time to publish after a commit.

## Prototype v0.6

- Type custom actions instead of choosing from mandatory menus.
- Explore the Hollow Road, Bell-Mist Valley, Sunken Chapel, Broken Bridge, Ashen Keep, Thornwood and Hunter's Camp.
- Interact with an ogre through combat, bribery, persuasion, sneaking or an environmental trick.
- Track health, coins and a small inventory; choices affect the game world.
- Local autosave in your browser; export a JSON backup in the Journal.
- Installable progressive web app shell with best-effort offline use after first visit.
- An optional **browser-local language model** to narrate world reactions, with no paid inference API.

### Important limitations

**Typing anything is allowed; interpreting everything is not yet solved.** The baseline game recognizes a useful range of actions, but a truly open world needs more work. If the rules engine does not recognize an action, the optional local AI can improvise an in-scene response. AI prose does **not** yet control stats, locations, quests or inventory. The world model remains intentionally deterministic.

The game has two optional narrators using [Transformers.js](https://github.com/huggingface/transformers.js) with WebGPU: [SmolLM2-135M-Instruct-ONNX-MHA](https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-MHA) at about **118 MB** for the lightweight version, and [SmolLM2-360M-Instruct-ONNX](https://huggingface.co/onnx-community/SmolLM2-360M-Instruct-ONNX) at about **272 MB** for the experimental clearer version (q4f16 weights only). The latter may improve readability but could be too slow or memory-hungry for some iPhones. Both can be incoherent. Narration prompts now request short, plain-English text with less random sampling; obviously malformed replies are discarded in favor of the reliable deterministic result. Recent Safari/iOS with WebGPU and sufficient free memory is needed. Model loading, generation speed and long-term cache retention are not guaranteed, especially on iPhones. Neither AI option downloads a model until you explicitly select it.

A browser connection is required initially to fetch app files, the model and its dependencies. Once the UI shell has been cached, the rules engine can work offline; local model caches are browser-managed and may be evicted. The project does not use server-side API keys. Source dependencies/model files are downloaded from a public CDN and Hugging Face; prompts are generated locally once loaded.

## Development

No bundler, Node server, database or paid hosting is required.

- `index.html` — responsive story interface
- `app.js` — gameplay UI, autosaves, optional model worker
- `game.js` — world state, action interpretation and model prompt construction
- `ai-worker.js` — experimental on-device model inference
- `narration.js` — lightweight readability gate and safe fallback
- `sw.js` — best-effort offline app shell
- `tests/game.test.mjs` — deterministic engine checks

Run locally with any HTTP static file server, or open via GitHub Pages. For rule-engine tests:

```sh
npm test
```

The tests need Node 18 or later and no npm dependencies.

## Next milestones

1. **Device gate:** verify actual iPhone Safari WebGPU support, download size, time to first response, free memory, and whether the model produces plausible narrations.
2. **Meaningful free-form understanding:** an AI-to-actions JSON contract with validation so novel actions can change the world *without* hallucinating tracked state.
3. **Story consistency:** long-term episodic memory, NPC motives, quests, consequences, travel rules and save migration.
4. **RPG depth:** character creation, abilities, equipment, combat, skills, procedural encounters and optional dice.
5. **Reliability:** performance tests and offline/mobile recovery on real devices before considering the AI mode production-ready.

This is an **experimental prototype**, not a claim of unlimited ChatGPT-level storytelling at zero cost.

### Save compatibility

The v0.2 readability upgrade retains the v0.1 `unwritten-realms-save-v1` save key and schema. It does not reset existing adventures. Previously saved model prose is left unchanged; the new filter applies to future responses.

### iPhone crash prevention (v0.3)

On iPhone and iPad, the larger 360M WebGPU model is intentionally blocked **before** creating a Worker or requesting/download­ing model weights. Apple mobile Safari may terminate the page under WebGPU memory pressure, which JavaScript cannot always catch or recover from. Lightweight AI remains optional; the deterministic story engine remains available. A stalled AI load now times out after 120 seconds without progress, and worker failures clear the loading state. This update retains the `unwritten-realms-save-v1` save key, schema, and existing records.

### v0.4 — iPhone clearer writing

The iPhone button now **works** rather than silently blocking a model: it selects **Clearer writing**, which uses the safe 135M model with a smaller context, two short-sentence instruction and deterministic decoding. This is **not** the 360M model and may still produce unclear prose; unsuitable outputs fall back to normal game text. If the lightweight model has already loaded, tapping either option instantly switches writing style without re-downloading. Both buttons show loading feedback. The 360M model stays blocked on iPhone and iPad. Save key/schema unchanged.

## v0.5 adventure update

Complete first-story mystery with the third moon, a hunter named Mara, a watchtower, a moon vault, three distinct endings, paths around the ogre, more item use and clue gathering. Adds a persistent quest journal, discovered-location map, recap, large-text mode, one-turn undo and validated save restore. Existing save key and schema stay unchanged.

## v0.6.1 Home Screen compatibility hotfix

An installed iPhone Home Screen app displayed a desktop-only 360M button while hiding the actual experimental opt-in; the screenshot showed the footer v0.6. This was caused by relying on `navigator.userAgent`, `navigator.platform` and `navigator.maxTouchPoints` to choose which controls to show. v0.6.1 **always shows the experimental 360M consent control on every device**, and both standard buttons now remain the lightweight 135M model. 360M can only be requested by acknowledging risk and tapping its separate button; it is never downloaded or loaded automatically. Keep the original save key/schema, app manifest, icon and installed shortcut. Browser acceptance now includes a simulated iPhone-sized standalone viewport with a desktop-style user agent and zero touch points, plus undo/save/restore/offline checks. This is UI verification, NOT proof that 360M GPU inference succeeds on the real iPhone 17 Pro Max.

## v0.6 Mobile AI (experimental iPhone opt-in)

An opt-in 360M on-device narrator is available to try on newer iPhones, including 17 Pro Max. It does not automatically download or load, and defaults to the established lightweight 135M and clear-writing choices. A WebGPU adapter shader-f16 preflight runs before third-party code or model downloads; local prompts and output tokens are bounded. The user must explicitly acknowledge that Safari might still terminate the entire tab without throwing an error. This is not a guarantee of safety or compatibility: physical iPhone 17 Pro Max testing of the 360M model remains outstanding even with the opt-in available to the user. The game save key `unwritten-realms-save-v1` and schema 1, offline shell, no-paid-AI policy, and existing installed Home Screen identity remain unchanged. This v0.6 release is opt-in for the larger AI, and the working deterministic story engine remains available.

## v0.6.2 Home Screen checkbox/control fix

An iPhone 17 Pro Max Home Screen screenshot showed the risk checkbox visibly checked yet the 360M experiment button stayed disabled. This can happen if the UI does not receive or apply a checkbox change event. The experimental button is now always tappable when idle; its **click handler synchronously denies any load without checked consent** before Worker creation or model download. Tests reproduce checking the box without a `change` event, confirm enhanced worker selection when consent is present, and confirm zero Worker creation without consent even after reload. The small model, original on-device save key/schema, icon and installed shortcut are unchanged. A real iPhone GPU inference trial is still needed.

## v0.6.3: in-place WebGPU diagnostics and stale-shell isolation

Reports from an installed iPhone Home Screen shortcut said the 360M button still did not work. Audit found a real observability problem: several immediate early-return errors were only shown in `#ai-status` well below the phone-visible button, making a successful click look like a dead button. Now the 360M section displays click acknowledgment and GPU / Worker / download stages immediately below the button, with actionable GPU-01 / GPU-02 / GPU-03 / GPU-04 / MODEL-01 / WORKER-* messages. Versioned `app.js?v=063` and `ai-worker.js?v=063` prevent an old service-worker cache from mixing updated page markup with old JavaScript. This does not prove that an iPhone 17 Pro Max GPU can load 360M; physical test required. No paid API, save migration, icon, or manifest changes.

## v0.6.4 Home Screen startup-controller repair

A creator iPhone screenshot showed footer v0.6.3 but frozen `Waiting for controls` text even after tapping 360M. That indicates the main ES-module script did not complete initialization and did not attach the handlers; it does not prove a WebGPU/model failure. A tiny independent **classic inline** controller now catches failed module startup, intercepts an unhandled 360M tap and displays STARTUP-01 / STARTUP-02 / STARTUP-03 / STARTUP-04 directly under the button. A user-triggered **Repair game code (keeps saved adventure)** action unregisters only this app's service worker, deletes only `unwritten-realms-shell-*` CacheStorage entries, and reloads the same origin with a cache-refresh query. It never touches localStorage or schema-1 saves. The ES-module app calls `window.__unwrittenBoot.connected()` only when startup completes. Added genuine browser regression with forcibly aborted app.js request and saved-game-preserving repair. App/worker URLs changed to ?v=064 and shell cache to v10. Does not certify 360M model inference on iPhone.

## v0.6.5 GitHub Pages missing-module root cause and release parity

The actual creator iPhone Home Screen v0.6.4 screenshots showed STARTUP-03 failing to load `app.js?v=064`, STARTUP-01 after tapping, blank story on re-open, and STARTUP-02 after the save-safe cache repair. Source-level release audit identified the **proven root cause**: `.github/workflows/pages.yml` copied `app.js` and `game.js` into its published `dist` but omitted the `narration.js` and `ai-safety.js` files which `app.js` imports. Browsers refuse to execute the entire ES-module graph if any imported module is missing, so no game controls initialize. The prior Chromium smoke tested the source checkout root containing all files, not the actual deployed `dist`, and could not catch the omission.

v0.6.5 introduces `scripts/build-site.mjs` to collect and verify all needed static files, check local ES-module imports, service-worker shell references and manifest icons, and ensure exact source-byte parity. Both CI acceptance lanes build the same `dist`; Chromium now serves that exact artifact, and GitHub Pages deploys it (no manually curated copy list). Node deployment contract tests verify required files and that browser tests actually serve `dist`. Release also bumps the installed SW to `unwritten-realms-shell-v11` and app/worker URLs to `?v=065` for in-place update. Save key `unwritten-realms-save-v1` / schema 1, Home Screen manifest, icon, offline story, opt-in 360M and free local AI are unchanged. Passing browser tests will certify complete game initialization; true physical iPhone 360M WebGPU inference still requires device testing.

## v0.6.6 — mobile WebLLM 360M candidate + crash-loop guard (not physical certification)

Creator's iPhone 17 Pro Max test showed 360M began loading after v0.6.5 fixed the missing Pages modules, then the Home Screen app reset and crashed on another attempt. A reset/crash during WebGPU ONNX initialization is consistent with Safari memory pressure, **not confirmed without actual device crash logs**. The opt-in 360M model now uses a separate WebLLM runtime, pinned library `@mlc-ai/web-llm@0.2.89`, a publicly documented q4f16_1 SmolLM2 360M compiled model with 1024 context and 128 prefill to reduce working-memory demand. The 135M model and desktop behavior remain on the existing Transformers.js runtime; no paid inference API, automatic download, or forced fallback. A separate `unwritten-realms-360m-attempt-v1` key tracks unfinished loading/generation across Safari restarts without changing the existing `unwritten-realms-save-v1` game schema/key. If load did not finish, show SAFETY-02 and **block another heavy attempt** until the user explicitly authorizes one retry and re-checks consent; never automatically start model loading after restart. Node and Chromium test the crash marker, model selection, source/deployed artifact, saves, gameplay and offline startup. Browser simulations do not verify real iOS GPU inference.

**v0.6.6 model provenance update:** Use the official `prebuiltAppConfig.model_list` entry for `SmolLM2-360M-Instruct-q4f16_1-MLC` from the installed WebLLM version. This replaces the original candidate's external compiled model URLs and ensures model weights and WASM library are version matched. The original candidate wording above is superseded by this update. No additional network services beyond model download, no paid API.

## v0.6.7 — 360M compatibility and Pages artifact-index race

Creator asks for real 360M on iPhone after GPU loads repeatedly crashed. CPU compatibility selects the publisher's 8-bit SmolLM2-360M-Instruct ONNX model (`onnx/model_quantized.onnx`, ~363 MB) and runs it via `device:"wasm", dtype:"q8"` in an isolated Worker with 40 output tokens. The regular 135M and the faster experimental GPU WebLLM options remain; CPU is recommended for iPhone. GPU is **not required** to load CPU mode, and both larger modes require consent and retain the interruption guard. This may be slower and still subject to Safari limits; physical iPhone test remains needed. Schema-1 save, icon, manifest and existing shortcut unchanged.

Pages v0.6.6 had two failed deployments after a successful upload: deploy-pages immediately reported no `github-pages` artifact. Workflow now polls its own GitHub REST run artifacts until exactly one Pages artifact is indexed, then waits before deploy. Quality checks still apply to the identical deployed `dist`.
