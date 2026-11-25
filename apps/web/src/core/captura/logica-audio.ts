// Lógica pura del dictado por audio (navegadores sin reconocimiento de voz, como Firefox): pasar lo grabado a mono, a 16 kHz y a
// WAV PCM de 16 bits, que es lo que el servidor acepta. Sin navegador: se prueba con números.

/** Lo que el servidor espera: mono, 16 kHz, 16 bits. Suficiente para la voz y unas tres veces más liviano que 48 kHz. */
export const FRECUENCIA_DE_ENVIO = 16_000;
/** La grabación se detiene sola aquí (el servidor admite hasta 60 s). */
export const SEGUNDOS_MAXIMOS_DE_GRABACION = 45;

const BYTES_DE_CABECERA = 44;

/** Promedia los canales en uno. Sin canales, vacío. */
export function mezclarAMono(canales: readonly Float32Array[]): Float32Array {
  const primero = canales[0];
  if (!primero) return new Float32Array(0);
  if (canales.length === 1) return primero.slice();
  const largo = Math.min(...canales.map((c) => c.length));
  const salida = new Float32Array(largo);
  for (let i = 0; i < largo; i++) {
    let suma = 0;
    for (const c of canales) suma += c[i] ?? 0;
    salida[i] = suma / canales.length;
  }
  return salida;
}

/** Bajar de frecuencia promediando cada tramo (un filtro sencillo contra el ruido de aliasing). */
function bajar(muestras: Float32Array, razon: number, largo: number): Float32Array {
  const salida = new Float32Array(largo);
  for (let i = 0; i < largo; i++) {
    const desde = Math.floor(i * razon);
    const hasta = Math.min(muestras.length, Math.max(desde + 1, Math.floor((i + 1) * razon)));
    let suma = 0;
    for (let j = desde; j < hasta; j++) suma += muestras[j] ?? 0;
    salida[i] = suma / (hasta - desde);
  }
  return salida;
}

/** Subir de frecuencia interpolando entre muestras vecinas. */
function subir(muestras: Float32Array, razon: number, largo: number): Float32Array {
  const salida = new Float32Array(largo);
  const ultima = muestras.length - 1;
  for (let i = 0; i < largo; i++) {
    const pos = i * razon;
    const izq = Math.min(Math.floor(pos), ultima);
    const der = Math.min(izq + 1, ultima);
    const t = pos - izq;
    salida[i] = (muestras[izq] ?? 0) * (1 - t) + (muestras[der] ?? 0) * t;
  }
  return salida;
}

/** Cambia la frecuencia de muestreo. La duración se conserva: el largo nuevo es `largo × destino / origen`. */
export function remuestrear(muestras: Float32Array, origen: number, destino: number): Float32Array {
  if (origen <= 0 || destino <= 0) throw new RangeError('Frecuencia inválida.');
  if (origen === destino || muestras.length === 0) return muestras.slice();
  const largo = Math.round((muestras.length * destino) / origen);
  const razon = origen / destino;
  return razon > 1 ? bajar(muestras, razon, largo) : subir(muestras, razon, largo);
}

/** De -1…1 a entero de 16 bits. Lo que se pasa del rango se recorta; lo que no es número, silencio. */
export function aEntero16(muestra: number): number {
  if (!Number.isFinite(muestra)) return 0;
  const m = Math.max(-1, Math.min(1, muestra));
  return m < 0 ? Math.round(m * 0x8000) : Math.round(m * 0x7fff);
}

/** WAV PCM de 16 bits, mono, con la cabecera RIFF de 44 bytes. */
export function codificarWav(muestras: Float32Array, frecuencia: number): Uint8Array {
  const bytesDeDatos = muestras.length * 2;
  const salida = new Uint8Array(BYTES_DE_CABECERA + bytesDeDatos);
  const v = new DataView(salida.buffer);
  const texto = (pos: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(pos + i, t.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + bytesDeDatos, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, frecuencia, true);
  v.setUint32(28, frecuencia * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, bytesDeDatos, true);
  for (let i = 0; i < muestras.length; i++) v.setInt16(BYTES_DE_CABECERA + i * 2, aEntero16(muestras[i] ?? 0), true);
  return salida;
}

/** Los canales grabados, listos para enviar: mono, 16 kHz, WAV. */
export const prepararWav = (canales: readonly Float32Array[], frecuencia: number): Uint8Array =>
  codificarWav(remuestrear(mezclarAMono(canales), frecuencia, FRECUENCIA_DE_ENVIO), FRECUENCIA_DE_ENVIO);

/** Base64 sin desbordar la pila: de a trozos. */
export function bytesABase64(bytes: Uint8Array): string {
  let binario = '';
  const TROZO = 0x8000;
  for (let i = 0; i < bytes.length; i += TROZO) binario += String.fromCharCode(...bytes.subarray(i, i + TROZO));
  return btoa(binario);
}
