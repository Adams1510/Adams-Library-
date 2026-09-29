import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/server',
    emptyOutDir: false,
    minify: true,
    sourcemap: true,
    lib: {
      entry: 'server/worker.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {inlineDynamicImports:true},
    },
  },
});
