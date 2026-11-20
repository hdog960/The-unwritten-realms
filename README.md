# The Unwritten Realms

**Your words. Your world. Your legend.**

A free, mobile-first, text-based fantasy RPG designed for GitHub Pages. This project is **independent of Mythwrought**.

## Play

**GitHub Pages:** https://hdog960.github.io/The-unwritten-realms/

GitHub Pages should be configured for **GitHub Actions** (the repository has an explicit deploy workflow). Changes may take a little time to publish after a commit.

## Prototype v0.4

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
