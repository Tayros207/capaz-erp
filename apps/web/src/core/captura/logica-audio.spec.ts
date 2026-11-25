import { describe, expect, it } from 'vitest';
import { aEntero16, bytesABase64, codificarWav, FRECUENCIA_DE_ENVIO, mezclarAMono, prepararWav, remuestrear } from './logica-audio.ts';

const vista = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const texto = (b: Uint8Array, desde: number) => String.fromCharCode(...b.subarray(desde, desde + 4));
const muestrasDe = (wav: Uint8Array) => Array.from({ length: (wav.length - 44) / 2 }, (_, i) => vista(wav).getInt16(44 + i * 2, true));

describe('codificarWav', () => {
  it('escribe la cabecera RIFF de un PCM de 16 bits, mono, a la frecuencia pedida', () => {
    const wav = codificarWav(new Float32Array(10), 16_000);
    const v = vista(wav);
    expect(texto(wav, 0)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + 20);
    expect(texto(wav, 8)).toBe('WAVE');
    expect(texto(wav, 12)).toBe('fmt ');
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(texto(wav, 36)).toBe('data');
    expect(v.getUint32(40, true)).toBe(20);
  });

  it('el largo es 44 bytes de cabecera más 2 por muestra', () => {
    expect(codificarWav(new Float32Array(0), 16_000)).toHaveLength(44);
    expect(codificarWav(new Float32Array(16_000), 16_000)).toHaveLength(44 + 32_000);
  });

  it('el silencio queda en ceros', () => {
    expect(muestrasDe(codificarWav(new Float32Array(50), 16_000)).every((m) => m === 0)).toBe(true);
  });

  it('las muestras fuera de rango se recortan y lo que no es número es silencio', () => {
    expect(muestrasDe(codificarWav(Float32Array.from([1, -1, 1.5, -2, 0.5, Number.NaN]), 16_000))).toEqual([32_767, -32_768, 32_767, -32_768, 16_384, 0]);
    expect(aEntero16(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('mezclarAMono', () => {
  it('promedia los canales', () => {
    expect(Array.from(mezclarAMono([Float32Array.from([1, 0, 0.5]), Float32Array.from([0, 1, 0.5])]))).toEqual([0.5, 0.5, 0.5]);
  });
  it('un canal queda igual (copiado) y sin canales sale vacío', () => {
    const uno = Float32Array.from([0.25, -0.25]);
    const salida = mezclarAMono([uno]);
    expect(Array.from(salida)).toEqual([0.25, -0.25]);
    expect(salida).not.toBe(uno);
    expect(mezclarAMono([])).toHaveLength(0);
  });
  it('con canales de distinto largo usa el más corto', () => {
    expect(mezclarAMono([new Float32Array(5), new Float32Array(3)])).toHaveLength(3);
  });
});

describe('remuestrear', () => {
  it('de 48 kHz a 16 kHz conserva la duración y una señal constante', () => {
    const salida = remuestrear(new Float32Array(48_000).fill(0.5), 48_000, 16_000);
    expect(salida).toHaveLength(16_000);
    expect(salida.every((m) => Math.abs(m - 0.5) < 1e-6)).toBe(true);
  });
  it('de 44,1 kHz (razón no entera) da el largo redondeado', () => {
    expect(remuestrear(new Float32Array(44_100), 44_100, 16_000)).toHaveLength(16_000);
  });
  it('subir de 8 kHz interpola entre muestras', () => {
    expect(Array.from(remuestrear(Float32Array.from([0, 1]), 8_000, 16_000))).toEqual([0, 0.5, 1, 1]);
  });
  it('a la misma frecuencia no cambia nada; una frecuencia inválida no pasa', () => {
    expect(Array.from(remuestrear(Float32Array.from([0.1, 0.2]), 16_000, 16_000))).toEqual([Math.fround(0.1), Math.fround(0.2)]);
    expect(() => remuestrear(new Float32Array(2), 0, 16_000)).toThrow(RangeError);
  });
});

describe('prepararWav', () => {
  it('lo grabado en estéreo a 48 kHz sale mono a 16 kHz', () => {
    const wav = prepararWav([new Float32Array(48_000), new Float32Array(48_000)], 48_000);
    const v = vista(wav);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(FRECUENCIA_DE_ENVIO);
    expect(wav).toHaveLength(44 + FRECUENCIA_DE_ENVIO * 2);
  });
});

describe('bytesABase64', () => {
  it('codifica bien, también con más de un trozo (ida y vuelta)', () => {
    expect(bytesABase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 37) % 256);
    expect(Uint8Array.from(atob(bytesABase64(bytes)), (c) => c.charCodeAt(0))).toEqual(bytes);
    expect(bytesABase64(new Uint8Array(0))).toBe('');
  });
});
