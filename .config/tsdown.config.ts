import { defineConfig } from 'tsdown';

/** Shared base for every package's `tsdown.config.ts`, which adds its own `entry` via `mergeConfig`. */
export default defineConfig({
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // Single ESM format + "type": "module" makes plain .js/.d.ts unambiguous.
  fixedExtension: false,
});
