import { mergeConfig } from 'tsdown';

import base from '../../.config/tsdown.config.ts';

export default mergeConfig(base, {
  entry: ['src/index.ts'],
  // Treat dependencies as having no side effects, so one used only for its types leaves no import in `dist/index.d.ts`.
  treeshake: { moduleSideEffects: [{ external: true, sideEffects: false }] },
});
