import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const embassyPath = path.resolve(__dirname, '../../apps/embassy/src/embassy.ts');

export default defineConfig([
  {
    input: path.resolve('src/index.ts'),
    external: (id) => {
      // Mark the embassy import as external (check both original and resolved paths)
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.includes('embassy/src/embassy') || 
          normalizedId === embassyPath.replace(/\\/g, '/')) {
        return true;
      }
      return false;
    },
    output: [
      { file: 'dist/index.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
      {
        file: 'dist/index.iife.js',
        format: 'iife',
        name: 'NostrPassProvider',
        sourcemap: true,
        globals: (id) => {
          // Handle the resolved path from Rollup
          if (id.includes('embassy/src/embassy')) {
            return 'NostrPassEmbassy';
          }
        }
      }
    ],
    plugins: [
      alias({
        entries: [
          {
            find: '@nostrpass/embassy/src/embassy',
            replacement: embassyPath
          },
          {
            find: /^\.\.\/\.\.\/apps\/embassy\/src\/embassy$/,
            replacement: embassyPath
          }
        ]
      }),
      nodeResolve({
        preferBuiltins: false,
        resolveOnly: [] // Don't resolve anything, just let alias handle it
      }),
      typescript({ 
        tsconfig: path.resolve('tsconfig.json'), 
        declaration: false,
        filterRoot: path.resolve(__dirname)
      })
    ]
  }
]);


