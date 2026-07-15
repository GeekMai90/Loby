import type { ZenSoundId } from "./zenMode";

interface SoundNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

export class ZenSoundscape {
  private context: AudioContext | null = null;
  private nodes: SoundNodes | null = null;

  async play(soundId: ZenSoundId): Promise<void> {
    this.stopNodes();
    const context = this.context ?? new AudioContext();
    this.context = context;
    if (context.state === "suspended") await context.resume();

    const source = context.createBufferSource();
    source.buffer = createNoiseBuffer(context, soundId === "forest" || soundId === "fireplace" ? "brown" : "white");
    source.loop = true;

    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    configureSound(soundId, filter, gain);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    const nodes: SoundNodes = { source, filter, gain };
    if (soundId === "ocean" || soundId === "rain") {
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = soundId === "ocean" ? 0.09 : 0.22;
      lfoGain.gain.value = soundId === "ocean" ? 0.055 : 0.018;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      nodes.lfo = lfo;
      nodes.lfoGain = lfoGain;
    }

    source.start();
    this.nodes = nodes;
  }

  stop(): void {
    this.stopNodes();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }

  private stopNodes(): void {
    if (!this.nodes) return;
    try {
      this.nodes.source.stop();
      this.nodes.lfo?.stop();
    } catch {
      // Audio nodes may already be stopped while the window is closing.
    }
    this.nodes.source.disconnect();
    this.nodes.filter.disconnect();
    this.nodes.gain.disconnect();
    this.nodes.lfo?.disconnect();
    this.nodes.lfoGain?.disconnect();
    this.nodes = null;
  }
}

function configureSound(soundId: ZenSoundId, filter: BiquadFilterNode, gain: GainNode): void {
  filter.type = "lowpass";
  if (soundId === "rain") {
    filter.frequency.value = 6_200;
    filter.Q.value = 0.35;
    gain.gain.value = 0.105;
    return;
  }
  if (soundId === "ocean") {
    filter.frequency.value = 720;
    filter.Q.value = 0.65;
    gain.gain.value = 0.095;
    return;
  }
  if (soundId === "forest") {
    filter.frequency.value = 1_900;
    filter.Q.value = 0.45;
    gain.gain.value = 0.065;
    return;
  }
  filter.frequency.value = 980;
  filter.Q.value = 1.2;
  gain.gain.value = 0.075;
}

function createNoiseBuffer(context: AudioContext, kind: "white" | "brown"): AudioBuffer {
  const frameCount = context.sampleRate * 4;
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < frameCount; index += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") {
      data[index] = white * 0.58;
    } else {
      last = (last + 0.018 * white) / 1.018;
      data[index] = last * 3.2;
    }
  }
  return buffer;
}
