import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const TARGET = resolve('dist/index.iife.js');
const BUDGET_GZIP_BYTES = 45000; // ~45KB gzip budget

try {
  const buf = await readFile(TARGET);
  const gz = gzipSync(buf);
  const size = gz.length;
  console.log(`Provider IIFE gzip size: ${(size / 1024).toFixed(2)} KB (budget ${(BUDGET_GZIP_BYTES/1024).toFixed(1)} KB)`);
  if (size > BUDGET_GZIP_BYTES) {
    console.error(`❌ Size budget exceeded for ${TARGET}: ${size} bytes > ${BUDGET_GZIP_BYTES} bytes`);
    process.exit(1);
  } else {
    console.log('✅ Size within budget');
  }
} catch (e) {
  console.error('Failed to check size:', e);
  process.exit(1);
}


