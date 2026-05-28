import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const VOICE_DIR = path.join(ROOT, 'memory', 'voice_cache');

export interface VoiceConfig {
  sttEngine: 'whisper' | 'vosk' | 'none';
  ttsEngine: 'piper' | 'say' | 'espeak' | 'openai' | 'none';
  whisperModel: string;
  voiceId: string;
  speed: number;
}

export interface STTResult {
  text: string;
  confidence: number;
  duration: number;
  engine: string;
}

export class VoiceEntity {
  private config: VoiceConfig = {
    sttEngine: 'none',
    ttsEngine: 'none',
    whisperModel: 'base',
    voiceId: 'en_US-lessac-medium',
    speed: 1.0
  };

  private initialized = false;

  async init(): Promise<void> {
    await fs.mkdir(VOICE_DIR, { recursive: true });
    await this.detectEngines();
    this.initialized = true;
  }

  private async detectEngines(): Promise<void> {
    // Detect STT
    if (await this.commandExists('whisper')) {
      this.config.sttEngine = 'whisper';
      console.log('🎤 STT engine: Whisper');
    } else if (await this.commandExists('vosk-transcriber')) {
      this.config.sttEngine = 'vosk';
      console.log('🎤 STT engine: Vosk');
    } else {
      console.log('🎤 STT: No engine found (whisper/vosk). Install whisper: pip install openai-whisper');
    }

    // Detect TTS
    if (await this.commandExists('piper')) {
      this.config.ttsEngine = 'piper';
      console.log('🔊 TTS engine: Piper');
    } else if (process.platform === 'darwin' && await this.commandExists('say')) {
      this.config.ttsEngine = 'say';
      console.log('🔊 TTS engine: macOS say');
    } else if (await this.commandExists('espeak')) {
      this.config.ttsEngine = 'espeak';
      console.log('🔊 TTS engine: eSpeak');
    } else {
      console.log('🔊 TTS: No engine found (piper/espeak). Install piper: pip install piper-tts');
    }
  }

  private async commandExists(cmd: string): Promise<boolean> {
    try {
      await execAsync(`which ${cmd} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  async transcribeFromMicrophone(durationSec: number = 5): Promise<STTResult> {
    if (this.config.sttEngine === 'none') {
      throw new Error('No STT engine available. Install whisper: pip install openai-whisper');
    }

    const audioFile = path.join(VOICE_DIR, `mic_${Date.now()}.wav`);

    try {
      // Record audio
      if (process.platform === 'linux') {
        await execAsync(`arecord -d ${durationSec} -r 16000 -f S16_LE -c 1 "${audioFile}" 2>/dev/null`);
      } else if (process.platform === 'darwin') {
        await execAsync(`rec "${audioFile}" trim 0 ${durationSec} rate 16k 2>/dev/null`);
      }

      return await this.transcribeFile(audioFile);
    } finally {
      await fs.unlink(audioFile).catch(() => {});
    }
  }

  async transcribeFile(filePath: string): Promise<STTResult> {
    const start = Date.now();

    if (this.config.sttEngine === 'whisper') {
      return this.transcribeWithWhisper(filePath, start);
    } else if (this.config.sttEngine === 'vosk') {
      return this.transcribeWithVosk(filePath, start);
    }

    throw new Error('No STT engine configured');
  }

  private async transcribeWithWhisper(filePath: string, start: number): Promise<STTResult> {
    const outDir = path.join(VOICE_DIR, `whisper_${Date.now()}`);
    await fs.mkdir(outDir, { recursive: true });

    try {
      const { stdout } = await execAsync(
        `whisper "${filePath}" --model ${this.config.whisperModel} --output_format txt --output_dir "${outDir}" 2>/dev/null`,
        { timeout: 120000 }
      );

      const baseName = path.basename(filePath, path.extname(filePath));
      const txtFile = path.join(outDir, `${baseName}.txt`);
      const text = await fs.readFile(txtFile, 'utf-8').catch(() => stdout.trim());

      return {
        text: text.trim(),
        confidence: 0.9,
        duration: (Date.now() - start) / 1000,
        engine: 'whisper'
      };
    } finally {
      await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async transcribeWithVosk(filePath: string, start: number): Promise<STTResult> {
    const { stdout } = await execAsync(
      `vosk-transcriber -m /usr/share/vosk/model -f "${filePath}" 2>/dev/null`,
      { timeout: 120000 }
    );

    return {
      text: stdout.trim(),
      confidence: 0.8,
      duration: (Date.now() - start) / 1000,
      engine: 'vosk'
    };
  }

  async speak(text: string): Promise<{ success: boolean; filePath?: string; engine: string }> {
    if (this.config.ttsEngine === 'none') {
      throw new Error('No TTS engine available. Install piper: pip install piper-tts');
    }

    const outFile = path.join(VOICE_DIR, `speech_${Date.now()}.wav`);

    try {
      switch (this.config.ttsEngine) {
        case 'piper':
          await this.speakPiper(text, outFile);
          break;
        case 'say':
          await execAsync(`say "${text.replace(/"/g, '\\"')}"`);
          break;
        case 'espeak':
          await execAsync(`espeak "${text.replace(/"/g, '\\"')}" -w "${outFile}"`);
          break;
      }

      // Try to play audio
      await this.playAudio(outFile);

      return { success: true, filePath: outFile, engine: this.config.ttsEngine };
    } catch {
      const result: { success: boolean; filePath: string; engine: string } = { success: false, filePath: '', engine: this.config.ttsEngine };
      return result;
    }
  }

  private async speakPiper(text: string, outFile: string): Promise<void> {
    const tmpFile = path.join(VOICE_DIR, `piper_input_${Date.now()}.txt`);
    await fs.writeFile(tmpFile, text);
    try {
      await execAsync(
        `cat "${tmpFile}" | piper --model ${this.config.voiceId} --output_file "${outFile}" 2>/dev/null`,
        { timeout: 30000 }
      );
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  private async playAudio(filePath: string): Promise<void> {
    try {
      if (process.platform === 'linux') {
        await execAsync(`aplay "${filePath}" 2>/dev/null || paplay "${filePath}" 2>/dev/null || ffplay -nodisp -autoexit "${filePath}" 2>/dev/null`);
      } else if (process.platform === 'darwin') {
        await execAsync(`afplay "${filePath}"`);
      }
    } catch {
      // Audio playback not available
    }
  }

  async synthesizeToFile(text: string, format: 'wav' | 'mp3' = 'wav'): Promise<string> {
    const outFile = path.join(VOICE_DIR, `synth_${Date.now()}.${format}`);

    if (this.config.ttsEngine === 'piper') {
      const tmpFile = path.join(VOICE_DIR, `piper_synth_${Date.now()}.txt`);
      await fs.writeFile(tmpFile, text);
      try {
        await execAsync(
          `cat "${tmpFile}" | piper --model ${this.config.voiceId} --output_file "${outFile}" 2>/dev/null`
        );
      } finally {
        await fs.unlink(tmpFile).catch(() => {});
      }
    } else if (this.config.ttsEngine === 'say') {
      await execAsync(`say "${text.replace(/"/g, '\\"')}" -o "${outFile}"`);
    } else if (this.config.ttsEngine === 'espeak') {
      await execAsync(`espeak "${text.replace(/"/g, '\\"')}" -w "${outFile}"`);
    }

    return outFile;
  }

  setVoice(voiceId: string): void {
    this.config.voiceId = voiceId;
  }

  setSpeed(speed: number): void {
    this.config.speed = Math.max(0.5, Math.min(2.0, speed));
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  isAvailable(): { stt: boolean; tts: boolean } {
    return {
      stt: this.config.sttEngine !== 'none',
      tts: this.config.ttsEngine !== 'none'
    };
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(VOICE_DIR);
      const now = Date.now();
      for (const f of files) {
        const fp = path.join(VOICE_DIR, f);
        const stat = await fs.stat(fp);
        if (now - stat.mtimeMs > 3600000) {
          await fs.unlink(fp);
        }
      }
    } catch {}
  }
}
