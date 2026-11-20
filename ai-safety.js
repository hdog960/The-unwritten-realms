// No model download occurs until the explicit Load action.
// Known mobile Safari memory limitations make our larger WebGPU model unsafe
// on iPhones/iPads. A friendly preflight prevents a crash-prone retry.
export function isAppleMobile(userAgent = "", platform = "", maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(String(userAgent)) ||
    (platform === "MacIntel" && Number(maxTouchPoints) > 1);
}
export function checkModelSupport(model, device = {}) {
  if (model === "enhanced" &&
      isAppleMobile(device.userAgent, device.platform, device.maxTouchPoints)) {
    return {
      allowed: false,
      message: "The larger AI is disabled on iPhone and iPad because it may crash Safari. Choose Lightweight AI or play with the story engine. No model was started and your save is safe."
    };
  }
  return { allowed: true, message: "" };
}
