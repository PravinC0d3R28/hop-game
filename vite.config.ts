import { defineConfig } from 'vite';

// 6.5: sourcemaps are emitted only for explicit QA builds
// (`vite build --mode dev`). The ordinary production/portal build
// (`npm run build`, mode "production") ships no .map files. Local debugging
// is unaffected — the vite dev server always generates source maps in-memory.
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2020',
    sourcemap: mode === 'dev',
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
