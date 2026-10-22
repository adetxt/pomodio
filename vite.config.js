import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// three.js stays on the CDN: these aliases point imports at the same URLs as the
// import map in index.html (which OrbitControls needs for its own bare 'three' import).
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

export default defineConfig({
  plugins: [viteSingleFile()],
  // the CSS minifier drops the space in `blur(16px) saturate(1.35)`, which Chrome then rejects
  build: { cssMinify: false },
  resolve: {
    alias: [
      { find: /^three$/, replacement: THREE_CDN + 'build/three.module.js' },
      { find: /^three\/addons\//, replacement: THREE_CDN + 'examples/jsm/' },
    ],
  },
});
