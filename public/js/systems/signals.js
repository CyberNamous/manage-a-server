// A tiny publish/subscribe channel. Simulation code emits what happened; the UI decides how to show it.
// This keeps systems/ free of DOM code while allowing visual feedback for purchases, upgrades, etc.
const listeners = new Set();
export function onSignal(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function emit(type, detail = {}) { for (const listener of listeners) { try { listener(type, detail); } catch { /* UI feedback must never break the simulation */ } } }
