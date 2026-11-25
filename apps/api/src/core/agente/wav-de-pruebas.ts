// Solo para las pruebas: un WAV PCM armado a mano (silencio), con lo que cada prueba quiera romper.

export type OpcionesDeWavDePrueba = { canales?: number; frecuencia?: number; bits?: number; codigo?: number; muestras?: number; extra?: Uint8Array; tamanoDeDatos?: number };

export function wavDePrueba(o: OpcionesDeWavDePrueba = {}): Uint8Array {
  const canales = o.canales ?? 1;
  const frecuencia = o.frecuencia ?? 16_000;
  const bits = o.bits ?? 16;
  const alineacion = canales * (bits / 8);
  const datos = (o.muestras ?? 1600) * alineacion;
  const extra = o.extra ?? new Uint8Array();
  const b = new Uint8Array(44 + extra.length + datos);
  const v = new DataView(b.buffer);
  const escribir = (pos: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(pos + i, t.charCodeAt(i));
  };
  escribir(0, 'RIFF');
  v.setUint32(4, b.length - 8, true);
  escribir(8, 'WAVE');
  escribir(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, o.codigo ?? 1, true);
  v.setUint16(22, canales, true);
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * alineacion, true);
  v.setUint16(32, alineacion, true);
  v.setUint16(34, bits, true);
  b.set(extra, 36);
  escribir(36 + extra.length, 'data');
  v.setUint32(40 + extra.length, o.tamanoDeDatos ?? datos, true);
  return b;
}

/** El WAV en base64, como lo manda la web. */
export const wavEnBase64 = (o: OpcionesDeWavDePrueba = {}): string => Buffer.from(wavDePrueba(o)).toString('base64');
