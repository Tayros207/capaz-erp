import { describe, expect, it } from 'vitest';
import { leerWav } from './audio-wav.js';
import { wavDePrueba } from './wav-de-pruebas.js';

/** Un bloque `LIST` de tamaño impar (con su byte de relleno), como los que agregan algunos programas. */
function bloqueList(): Uint8Array {
  const b = new Uint8Array(8 + 3 + 1);
  const v = new DataView(b.buffer);
  for (let i = 0; i < 4; i++) v.setUint8(i, 'LIST'.charCodeAt(i));
  v.setUint32(4, 3, true);
  return b;
}

describe('leerWav', () => {
  it('lee un WAV mono de 16 kHz y calcula la duración por los datos', () => {
    const r = leerWav(wavDePrueba({ muestras: 16_000 * 3 }));
    expect(r).toEqual({ ok: true, cabecera: { canales: 1, frecuencia: 16_000, bitsPorMuestra: 16, bytesDeDatos: 96_000, segundos: 3 } });
  });

  it('admite estéreo a 48 kHz y salta bloques extra con relleno', () => {
    const r = leerWav(wavDePrueba({ canales: 2, frecuencia: 48_000, muestras: 24_000, extra: bloqueList() }));
    expect(r.ok && r.cabecera.segundos).toBe(0.5);
  });

  it('rechaza lo que no es WAV o viene cortado', () => {
    expect(leerWav(new Uint8Array(10)).ok).toBe(false);
    expect(leerWav(new TextEncoder().encode('x'.repeat(100))).ok).toBe(false);
    const bueno = wavDePrueba();
    expect(leerWav(bueno.slice(0, bueno.length - 10)).ok).toBe(false);
    expect(leerWav(wavDePrueba({ tamanoDeDatos: 0xffff_ffff })).ok).toBe(false);
  });

  it('rechaza formatos que no son PCM de 16 bits o frecuencias absurdas', () => {
    expect(leerWav(wavDePrueba({ codigo: 3 })).ok).toBe(false);
    expect(leerWav(wavDePrueba({ bits: 8 })).ok).toBe(false);
    expect(leerWav(wavDePrueba({ canales: 6 })).ok).toBe(false);
    expect(leerWav(wavDePrueba({ frecuencia: 4_000 })).ok).toBe(false);
    expect(leerWav(wavDePrueba({ frecuencia: 96_000 })).ok).toBe(false);
  });

  it('rechaza un audio sin datos', () => {
    const r = leerWav(wavDePrueba({ muestras: 0 }));
    expect(r).toEqual({ ok: false, motivo: 'El audio está vacío o cortado.' });
  });
});
