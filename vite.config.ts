import { defineConfig, Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** 生成器版本哈希：对 src/art/gen 下全部源码做内容哈希，代码一改缓存就失效 */
function codeArtHash(): Plugin {
  const dir = resolve(__dirname, 'src/art/gen');
  const VID = 'virtual:codeart-hash', RID = '\0' + VID;
  const compute = () => {
    const h = createHash('sha1');
    const walk = (d: string) => { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f)) { h.update(p.slice(dir.length)); h.update(readFileSync(p)); } } };
    walk(dir);
    return h.digest('hex').slice(0, 12);
  };
  return {
    name: 'codeart-hash',
    resolveId: (id) => (id === VID ? RID : null),
    load: (id) => (id === RID ? `export const CODEART_HASH = ${JSON.stringify(compute())};` : null),
    handleHotUpdate({ file, server }) {
      if (file.startsWith(dir)) { const m = server.moduleGraph.getModuleById(RID); if (m) server.moduleGraph.invalidateModule(m); }
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5180 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  worker: { format: 'es', plugins: () => [codeArtHash()] },
  plugins: [codeArtHash()],
});
