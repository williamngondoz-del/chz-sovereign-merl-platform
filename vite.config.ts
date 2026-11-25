import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1300,
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dep) => !dep.includes('three') && !dep.includes('SovereignGlobe3D'));
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/zustand/') ||
            id.includes('node_modules/use-sync-external-store/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/three') || id.includes('@react-three')) {
            return 'three-vendor';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
