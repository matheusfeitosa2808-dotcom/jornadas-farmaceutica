import { EventEmitter } from "node:events";
const context = globalThis as unknown as { jornadasEvents?: EventEmitter };
export const events = context.jornadasEvents ?? new EventEmitter();
context.jornadasEvents = events;
events.setMaxListeners(500);
export function publish(editionId: string) {
  events.emit("update", { editionId, at: new Date().toISOString() });
}
export function subscribe(
  editionId: string,
  handler: (data: { editionId: string; at: string }) => void,
) {
  const listener = (data: { editionId: string; at: string }) => {
    if (editionId === "*" || data.editionId === editionId) handler(data);
  };
  events.on("update", listener);
  return () => events.off("update", listener);
}
