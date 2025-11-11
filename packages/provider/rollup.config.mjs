import path from 'node:path';
import { defineConfig } from 'rollup';
import typescript from '@rollup/plugin-typescript';

export default defineConfig([
  {
    input: path.resolve('src/index.ts'),
    external: ['@nostrpass/embassy/src/embassy'],
    output: [
      { file: 'dist/index.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
      {
        file: 'dist/index.iife.js',
        format: 'iife',
        name: 'NostrPassProvider',
        sourcemap: true,
        globals: {
          '@nostrpass/embassy/src/embassy': 'NostrPassEmbassy'
        }
      }
    ],
    plugins: [
      typescript({ tsconfig: path.resolve('tsconfig.json'), declaration: false })
    ]
  }
]);


