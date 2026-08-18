import { defineConfig } from 'vite';

// 6.5: sourcemap behavior by build profile.
//   - mode "dev" (QA build, `vite build --mode dev`): full source maps.
//   - mode "analyze" (private error-analysis build, `npm run build:analyze`):
//     'hidden' maps — generated but WITHOUT the sourceMappingURL comment, so
//     browsers never auto-fetch them; a post-build script then moves them out
//     of dist/ into error-maps/ (outside the public package).
//   - anything else (ordinary `npm run build`, mode "production"): no maps.
// Local debugging is unaffected — the vite dev server always generates source
// maps in-memory.
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2020',
    sourcemap: mode === 'dev' ? true : mode === 'analyze' ? 'hidden' : false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap']
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
}));
