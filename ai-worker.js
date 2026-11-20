// Model downloads and generation happen inside this worker, never on a paid inference API.
// A small model is experimental: iOS/WebGPU support and narration quality vary by device.
const MODELS = Object.freeze({
  light: "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA",
  enhanced: "onnx-community/SmolLM2-360M-Instruct-ONNX"
});
let generator = null;

self.onmessage = async ({ data }) => {
  if (!data || !data.type) return;
  if (data.type === "init") {
    try {
      if (!self.navigator?.gpu) throw new Error("WebGPU is unavailable inside the worker");
      const { pipeline } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm");
      const model = MODELS[data.model] ? data.model : "light";
      generator = await pipeline("text-generation", MODELS[model], {
        device: "webgpu",
        dtype: "q4f16",
        progress_callback: status => {
          if (!status) return;
          if (status.status === "progress" || status.status === "download") {
            self.postMessage({ type: "progress", file: String(status.file || "model"), percent: status.progress });
          }
        }
      });
      self.postMessage({ type: "ready", model });
    } catch (error) {
      generator = null;
      self.postMessage({ type: "error", message: String(error?.message || error) });
    }
  }
  if (data.type === "generate") {
    if (!generator) {
      self.postMessage({ type: "error", id: data.id, message: "Model is not loaded" });
      return;
    }
    try {
      const response = await generator(data.messages, {
        max_new_tokens: 105,
        do_sample: true,
        temperature: 0.45,
        top_p: 0.85,
        repetition_penalty: 1.16,
        return_full_text: false
      });
      const raw = response?.[0]?.generated_text;
      let output = typeof raw === "string" ? raw : "";
      if (Array.isArray(raw)) output = String(raw.at(-1)?.content || "");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) output = String(raw.content || "");
      output = output.replace(/^assistant\s*:/i, "").replace(/<\|[^|]+\|>/g, "").trim();
      if (!output) throw new Error("Model returned empty output");
      self.postMessage({ type: "generated", id: data.id, text: output });
    } catch (error) {
      self.postMessage({ type: "error", id: data.id, message: String(error?.message || error) });
    }
  }
};
