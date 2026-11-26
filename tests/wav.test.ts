import { describe, expect, it } from 'vitest';
import { encodeWav } from '../src/export/wav';

describe('encodeWav', () => {
  it('writes a valid stereo 16-bit header and clamps samples', () => {
    const left = new Float32Array([0, 0.5, -0.5, 2]);
    const right = new Float32Array([0, -1, 1, -2]);
    const wav = encodeWav({
      numberOfChannels: 2,
      sampleRate: 44100,
      length: 4,
      getChannelData: (c) => (c === 0 ? left : right),
    });
    const v = new DataView(wav);
    const text = (o: number) => String.fromCharCode(...new Uint8Array(wav, o, 4));

    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(text(36)).toBe('data');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(40, true)).toBe(4 * 2 * 2);
    expect(wav.byteLength).toBe(44 + 16);
    // Frame 3: left 2 clamps to +max, right -2 clamps to -max.
    expect(v.getInt16(44 + 3 * 4, true)).toBe(0x7fff);
    expect(v.getInt16(44 + 3 * 4 + 2, true)).toBe(-0x8000);
  });
});
