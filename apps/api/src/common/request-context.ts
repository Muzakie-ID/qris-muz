import { AsyncLocalStorage } from 'node:async_hooks';

/** Data per request yang dibaca jauh di dalam service (mis. pelaku untuk audit log). */
export interface RequestContext {
  actor?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Middleware Express: setiap request mendapat konteks kosong sendiri. */
export function requestContextMiddleware(
  _req: unknown,
  _res: unknown,
  next: () => void,
): void {
  requestContext.run({}, next);
}

export function currentActor(): string {
  return requestContext.getStore()?.actor ?? 'system';
}

export function setActor(actor: string): void {
  const store = requestContext.getStore();
  if (store) store.actor = actor;
}
