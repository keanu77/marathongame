import { copyFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

function copyPublicProjectDocuments(): Plugin {
  const files = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md'] as const;

  return {
    name: 'copy-public-project-documents',
    apply: 'build',
    async closeBundle() {
      await Promise.all(
        files.map((file) =>
          copyFile(
            new URL(`./${file}`, import.meta.url),
            new URL(`./dist/${file}`, import.meta.url),
          ),
        ),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [copyPublicProjectDocuments()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      phaser: fileURLToPath(
        new URL('./node_modules/phaser/dist/phaser-arcade-physics.js', import.meta.url),
      ),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    chunkSizeWarningLimit: 1_200,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
