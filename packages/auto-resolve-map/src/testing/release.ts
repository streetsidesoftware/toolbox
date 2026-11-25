import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

setFlagsFromString('--expose-gc');
export const collectGarbage: () => void = runInNewContext('gc');

/** Collect garbage until a condition holds. Returns `false` if it never does. */
export async function releaseUntil(condition: () => boolean): Promise<boolean> {
  for (let i = 0; i < 20; ++i) {
    await releaseUnused();
    if (condition()) return true;
  }
  return false;
}

/** Collect garbage, and give finalization callbacks time to run. */
export async function releaseUnused(): Promise<void> {
  await releaseBeforeCleanup();
  await setImmediate();
}

/** Collect garbage. The caller continues before any finalization callback runs. */
export async function releaseBeforeCleanup(): Promise<void> {
  // End the turn first, so that values looked at in it can be collected.
  await setImmediate();
  collectGarbage();
}
