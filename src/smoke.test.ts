import { bootstrap } from './core/bootstrap.js';
import { DNA } from './core/dna.js';
import { UniversalMemory } from './memory/store.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSmokeTest() {
  console.log('🚀 Starting Smoke Test...');

  try {
    // 1. Bootstrap
    const result = await bootstrap();
    console.log('✓ Bootstrap finished', result);

    // 2. Load DNA
    const dna = await DNA.load();
    console.log('✓ DNA loaded:', dna.rawData.identity.name, dna.rawData.identity.version);

    if (dna.rawData.identity.name !== 'ULTIMATE') {
      throw new Error('DNA name mismatch');
    }

    // 3. Memory
    const memory = new UniversalMemory();
    await memory.restore();
    console.log('✓ Memory restored');

    await memory.remember('smoke-test', 'success');
    console.log('✓ Memory write success');

    console.log('✅ Smoke Test PASSED');
    process.exit(0);
  } catch (error) {
    console.error('❌ Smoke Test FAILED:', error);
    process.exit(1);
  }
}

runSmokeTest();
