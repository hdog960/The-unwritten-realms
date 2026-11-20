// Keep experimental local-model prose concise. Reject obvious malformed output
// instead of replacing a verified game-engine result with unreadable text.
export function cleanNarration(raw) {
  if (typeof raw !== "string") return null;
  let text = raw
    .replace(/<\|[^>]*\|>/g, "")
    .replace(/^(?:(?:assistant|narrator|response|answer)\s*:\s*)+/i, "")
    .replace(/^["'\x60]+|["'\x60]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
  if (/\b(as an ai|language model|system prompt|user prompt|I cannot comply|here is (?:the|a) (?:story|response))\b/i.test(text)) return null;
  if (/^\s*(?:#{1,6}\s|\d+[.)]\s|[-*]\s)/m.test(text)) return null;
  if (/\b(?:assistant|system|user)\s*:/i.test(text)) return null;
  text = text.replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10 || words.length > 115) return null;
  if (!/\b(you|your)\b/i.test(text)) return null;
  if (!/[.!?]$/.test(text)) return null;
  if (/(\b[a-z]{2,}\b)(?:[\s,.]+\1){3,}/i.test(text)) return null;
  if (/(.{24,})\1/i.test(text)) return null;
  if (/[{}<>]/.test(text)) return null;
  // Cut off any unfinished fourth or later sentence, keeping the prose readable.
  const sentences = text.match(/[^.!?]+[.!?]+(?:["']?)/g);
  if (!sentences || sentences.length === 0) return null;
  const short = sentences.slice(0, 4).join(" ").replace(/\s+/g, " ").trim();
  return short.length >= 45 && short.length <= 850 ? short : null;
}
