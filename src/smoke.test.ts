import { bootstrap } from './core/bootstrap.js';
import { DNA } from './core/dna.js';
import { UniversalMemory } from './memory/store.js';
import { Oracle } from './core/oracle.js';
import { PatchEngine } from './core/patch_engine.js';
import { HiveMind } from './core/hive_mind.js';
import { VoiceEntity } from './core/voice_entity.js';
import { Architect } from './core/architect.js';
import { IntentEngine } from './core/intent_engine.js';
import { LLMEngine } from './core/llm_engine.js';
import { Omniscience } from './core/omniscience.js';
import { SnapshotManager } from './core/snapshot.js';
import { SkillActivator } from './core/skill_activator.js';
import { SystemTools } from './core/system_tools.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, detail: string = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(name);
  }
}

async function runSmokeTest() {
  console.log('🚀 ULTIMATE Smoke Test Suite\n');

  // ── 1. Bootstrap ──────────────────────────────────
  console.log('[1/13] Bootstrap');
  try {
    const result = await bootstrap();
    assert('bootstrap returns result', !!result);
    assert('dnaPath exists', !!result.dnaPath);
  } catch (e: any) {
    assert('bootstrap', false, e.message);
  }

  // ── 2. DNA ────────────────────────────────────────
  console.log('[2/13] DNA');
  try {
    const dna = await DNA.load();
    assert('DNA loads', !!dna);
    assert('name is ULTIMATE', dna.rawData.identity.name === 'ULTIMATE');
    assert('has traits', !!dna.rawData.traits);
    assert('has logic trait', typeof dna.rawData.traits.logic === 'number');
    assert('has creativity trait', typeof dna.rawData.traits.creativity === 'number');
    assert('has caution trait', typeof dna.rawData.traits.caution === 'number');
    assert('has empathy trait', typeof dna.rawData.traits.empathy === 'number');
    assert('has ambition trait', typeof dna.rawData.traits.ambition === 'number');
    assert('has precision trait', typeof dna.rawData.traits.precision === 'number');
    assert('has traitHistory array', Array.isArray(dna.rawData.traitHistory));
    assert('getTraitProfile returns string', typeof dna.getTraitProfile() === 'string');
    assert('getDominantTrait returns string', typeof dna.getDominantTrait() === 'string');
    assert('getInstance matches load', DNA.getInstance() === dna);
  } catch (e: any) {
    assert('DNA', false, e.message);
  }

  // ── 3. DNA Migration ──────────────────────────────
  console.log('[3/13] DNA Migration');
  try {
    const oldDna = { identity: { name: 'TEST' }, mutations: 5 };
    const migrated = (DNA as any).migrate(oldDna);
    assert('migrate adds traits', !!migrated.traits);
    assert('migrate adds traitHistory', Array.isArray(migrated.traitHistory));
    assert('migrate preserves mutations', migrated.mutations === 5);
    assert('migrate preserves name', migrated.identity.name === 'TEST');
    assert('migrate adds default traits', migrated.traits.ambition === 0.5);
  } catch (e: any) {
    assert('DNA Migration', false, e.message);
  }

  // ── 4. Memory ─────────────────────────────────────
  console.log('[4/13] Memory');
  try {
    const memory = new UniversalMemory();
    await memory.restore();
    assert('memory restores', true);
    await memory.remember('interaction', { input: 'test query', output: 'ok' });
    assert('memory write', true);
    const results = await memory.recall('test query', 1);
    assert('memory recall returns results', results.length > 0);
    memory.setPreference('smoke-key', 'smoke-value');
    assert('memory setPreference', memory.getPreference('smoke-key') === 'smoke-value');
  } catch (e: any) {
    assert('Memory', false, e.message);
  }

  // ── 5. LLM Engine (Singleton) ─────────────────────
  console.log('[5/13] LLM Engine');
  try {
    const llm1 = LLMEngine.getInstance();
    const llm2 = LLMEngine.getInstance();
    assert('singleton returns instance', !!llm1);
    assert('singleton returns same instance', llm1 === llm2);
    assert('has generate method', typeof llm1.generate === 'function');
    assert('has generateSafe method', typeof llm1.generateSafe === 'function');
    assert('has generateWithRetry method', typeof llm1.generateWithRetry === 'function');
    assert('buildDefaultSystemPrompt returns string', typeof llm1.buildDefaultSystemPrompt() === 'string');
    assert('prompt contains ULTIMATE', llm1.buildDefaultSystemPrompt().includes('ULTIMATE'));
    assert('getActiveProvider returns string', typeof llm1.getActiveProvider() === 'string');
  } catch (e: any) {
    assert('LLM Engine', false, e.message);
  }

  // ── 6. Oracle ─────────────────────────────────────
  console.log('[6/13] Oracle');
  try {
    const oracle = new Oracle();
    await oracle.init();
    assert('oracle initializes', true);
    assert('getScreenshotCount is 0', oracle.getScreenshotCount() === 0);
    const recent = await oracle.getRecentScreenshots();
    assert('getRecentScreenshots returns array', Array.isArray(recent));
    await oracle.cleanupOldScreenshots(0);
    assert('cleanupOldScreenshots runs', true);
  } catch (e: any) {
    assert('Oracle', false, e.message);
  }

  // ── 7. Patch Engine ───────────────────────────────
  console.log('[7/13] Patch Engine');
  try {
    const patch = new PatchEngine();
    assert('patch engine creates', !!patch);

    // Test atomic write via quickPatch on a temp file
    const testFile = path.join(ROOT, '.smoke_test_patch.txt');
    await fs.writeFile(testFile, 'hello world');
    const ok = await patch.quickPatch(testFile, 'hello', 'goodbye');
    assert('quickPatch finds anchor', ok);
    const content = await fs.readFile(testFile, 'utf-8');
    assert('quickPatch replaces text', content.includes('goodbye'));
    await fs.unlink(testFile);

    // Test createPatch
    const plan = await patch.createPatch([
      { file: 'test.txt', type: 'replace', anchor: 'old', content: 'new' }
    ], 'smoke test');
    assert('createPatch returns plan', !!plan);
    assert('plan has id', typeof plan.id === 'string');
    assert('plan has operations', plan.operations.length === 1);

    // Test generateDiff
    const diff = await patch.generateDiff('line1\nline2', 'line1\nline3', 'test');
    assert('generateDiff returns string', typeof diff === 'string');

    // Test history
    assert('getHistory returns array', patch.getHistory().length > 0);
  } catch (e: any) {
    assert('Patch Engine', false, e.message);
  }

  // ── 8. Hive Mind ──────────────────────────────────
  console.log('[8/13] Hive Mind');
  try {
    const hive = new HiveMind();
    await hive.init();
    assert('hive initializes', true);
    const status = await hive.getStatus();
    assert('getStatus returns object', !!status);
    assert('has configured field', typeof status.configured === 'boolean');
    assert('has device field', typeof status.device === 'string');
    assert('device has length', status.device.length > 0);
  } catch (e: any) {
    assert('Hive Mind', false, e.message);
  }

  // ── 9. Voice Entity ───────────────────────────────
  console.log('[9/13] Voice Entity');
  try {
    const voice = new VoiceEntity();
    await voice.init();
    assert('voice initializes', true);
    const avail = voice.isAvailable();
    assert('isAvailable returns object', !!avail);
    assert('has stt field', typeof avail.stt === 'boolean');
    assert('has tts field', typeof avail.tts === 'boolean');
    const config = voice.getConfig();
    assert('getConfig returns object', !!config);
    assert('has sttEngine field', typeof config.sttEngine === 'string');
    assert('has ttsEngine field', typeof config.ttsEngine === 'string');
  } catch (e: any) {
    assert('Voice Entity', false, e.message);
  }

  // ── 10. Architect ─────────────────────────────────
  console.log('[10/13] Architect');
  try {
    const arch = new Architect();
    await arch.init();
    assert('architect initializes', true);
    const ctx = arch.getContext();
    assert('getContext returns object', !!ctx);
    assert('has name field', typeof ctx.name === 'string');
    const tasks = arch.getTasks();
    assert('getTasks returns array', Array.isArray(tasks));
    const status = await arch.getProjectStatus();
    assert('getProjectStatus returns string', typeof status === 'string');
    assert('status contains PROJECT STATUS', status.includes('PROJECT STATUS'));
  } catch (e: any) {
    assert('Architect', false, e.message);
  }

  // ── 11. Intent Engine ─────────────────────────────
  console.log('[11/13] Intent Engine');
  try {
    const intent = new IntentEngine();
    assert('intent engine creates', !!intent);

    // Test command detection
    const cmd = await intent.perceive('/help');
    assert('detects /help command', cmd.isCommand === true);
    assert('commandName is help', cmd.commandName === 'help');

    // Test transformation detection
    const transform = await intent.perceive('become a cybersecurity expert');
    assert('detects become command', transform.transformationNeeded === true);
    assert('targetForm set', transform.targetForm !== null);

    // Test regular message fallback
    const regular = await intent.perceive('hello world');
    assert('regular message returns intent', !!regular);
    assert('has surface field', typeof regular.surface === 'string');
  } catch (e: any) {
    assert('Intent Engine', false, e.message);
  }

  // ── 12. Omniscience ───────────────────────────────
  console.log('[12/13] Omniscience');
  try {
    const omni = new Omniscience();
    assert('omniscience creates', !!omni);
    const alerts = omni.getRecentAlerts();
    assert('getRecentAlerts returns array', Array.isArray(alerts));
    assert('alerts initially empty', alerts.length === 0);

    // Test event listener
    let receivedAlert = '';
    const unsub = omni.onAlert((a) => { receivedAlert = a; });
    assert('onAlert returns unsubscribe', typeof unsub === 'function');
    unsub();
  } catch (e: any) {
    assert('Omniscience', false, e.message);
  }

  // ── 13. Snapshot Manager ──────────────────────────
  console.log('[13/13] Snapshot + Skill + SystemTools');
  try {
    const snap = new SnapshotManager();
    assert('snapshot manager creates', !!snap);

    const skills = new SkillActivator();
    assert('skill activator creates', !!skills);
    assert('getActiveContext returns string', typeof skills.getActiveContext() === 'string');

    const sys = new SystemTools();
    assert('system tools creates', !!sys);
    const execResult = await sys.exec('echo "hello"');
    assert('exec runs command', execResult.success);
    assert('exec returns stdout', execResult.stdout === 'hello');
  } catch (e: any) {
    assert('Snapshot/Skill/SystemTools', false, e.message);
  }

  // ── Summary ───────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
  }

  console.log('');
  if (failed === 0) {
    console.log('✅ All smoke tests PASSED');
    process.exit(0);
  } else {
    console.log('❌ Smoke tests FAILED');
    process.exit(1);
  }
}

runSmokeTest();
