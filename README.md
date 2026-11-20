# The Unwritten Realms

**Your words. Your world. Your legend.**

A free, mobile-first, text-based fantasy RPG designed for GitHub Pages. This project is **independent of Mythwrought**.

## Play

**GitHub Pages:** https://hdog960.github.io/The-unwritten-realms/

GitHub Pages should be configured for **Deploy from a branch → main → /(root)**. Changes may take a little time to publish after a commit.

## Prototype v0.1

- Type custom actions instead of choosing from mandatory menus.
- Explore the Hollow Road, Bell-Mist Valley, Sunken Chapel, Broken Bridge, Ashen Keep, Thornwood and Hunter's Camp.
- Interact with an ogre through combat, bribery, persuasion, sneaking or an environmental trick.
- Track health, coins and a small inventory; choices affect the game world.
- Local autosave in your browser; export a JSON backup in the Journal.
- Installable progressive web app shell with best-effort offline use after first visit.
- An optional **browser-local language model** to narrate world reactions, with no paid inference API.

### Important limitations

**Typing anything is allowed; interpreting everything is not yet solved.** The baseline game recognizes a useful range of actions, but a truly open world needs more work. If the rules engine does not recognize an action, the optional local AI can improvise an in-scene response. AI prose does **not** yet control stats, locations, quests or inventory. The world model remains intentionally deterministic.

Local AI currently tries [SmolLM2-135M-Instruct-ONNX-MHA](https://huggingface.co/onnx-community/SmolLM2-135M-Instruct-ONNX-MHA) using [Transformers.js](https://github.com/huggingface/transformers.js) in a Web Worker on WebGPU. The compact q4f16 weights are about **118 MB**, plus runtime/tokenizer resources. This is a very small model; narration quality can be limited. Recent Safari/iOS with WebGPU and sufficient free memory is needed. Model loading, generation speed and long-term cache retention are not guaranteed, especially on iPhones. The AI option **does not download anything until you press Enable local AI**.

A browser connection is required initially to fetch app files, the model and its dependencies. Once the UI shell has been cached, the rules engine can work offline; local model caches are browser-managed and may be evicted. The project does not use server-side API keys. Source dependencies/model files are downloaded from a public CDN and Hugging Face; prompts are generated locally once loaded.

## Development

No bundler, Node server, database or paid hosting is required.

- `index.html` — responsive story interface
- `app.js` — gameplay UI, autosaves, optional model worker
- `game.js` — world state, action interpretation and model prompt construction
- `ai-worker.js` — experimental on-device model inference
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
