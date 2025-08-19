export function emitAchievement(message) {
  window.dispatchEvent(new CustomEvent("achievement:unlock", { detail: { message } }));
}