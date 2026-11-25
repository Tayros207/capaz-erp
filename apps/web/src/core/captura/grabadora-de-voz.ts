import { transcribirAudio } from './api.ts';
import { bytesABase64, prepararWav, SEGUNDOS_MAXIMOS_DE_GRABACION } from './logica-audio.ts';
import { AVISO_GRABACION_ILEGIBLE, avisoDeErrorDeVoz, codigoDeErrorDeMicrofono, desenlaceDeTranscripcion, type DesenlaceDeTranscripcion } from './logica-reconocedor.ts';

// La vía de audio del dictado (navegadores sin Web Speech, como Firefox): micrófono → `MediaRecorder` → WAV mono de 16 kHz en el
// navegador → el servidor lo transcribe. El audio NO se guarda: el servidor lo manda al modelo y lo olvida. Sin React: el hook
// `use-reconocedor-por-audio.ts` la envuelve y pone en pantalla lo que ella le avisa.

type Grabacion = { grabadora: MediaRecorder; flujo: MediaStream; tope: ReturnType<typeof setTimeout> };

/** Lo que la grabadora le cuenta a la pantalla. */
export type AvisosDeGrabadora = {
  alGrabar: () => void;
  alTranscribir: (porTope: boolean) => void;
  alResultado: (d: DesenlaceDeTranscripcion) => void;
  alFallar: (aviso: string) => void;
};

const apagarPistas = (flujo: MediaStream) => flujo.getTracks().forEach((pista) => pista.stop());

/** Abre el micrófono, o dice por qué no se pudo con el mismo aviso que Web Speech. */
async function abrirMicrofono(): Promise<{ flujo: MediaStream } | { aviso: string }> {
  try {
    return { flujo: await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }) };
  } catch (e) {
    const codigo = codigoDeErrorDeMicrofono(e instanceof Error ? e.name : '');
    return { aviso: avisoDeErrorDeVoz(codigo, /android/i.test(navigator.userAgent)) ?? 'No se pudo usar el micrófono. Escribe el texto.' };
  }
}

/** Arranca la grabadora. `alParar` recibe lo grabado cuando se detiene (a mano o por el tope de tiempo). */
function empezarGrabacion(flujo: MediaStream, alTope: () => void, alParar: (grabado: Blob) => void): Grabacion {
  const grabadora = new MediaRecorder(flujo);
  const trozos: Blob[] = [];
  grabadora.ondataavailable = (e) => {
    if (e.data.size > 0) trozos.push(e.data);
  };
  grabadora.onstop = () => {
    apagarPistas(flujo);
    alParar(new Blob(trozos, { type: grabadora.mimeType }));
  };
  grabadora.start();
  return { grabadora, flujo, tope: setTimeout(alTope, SEGUNDOS_MAXIMOS_DE_GRABACION * 1000) };
}

/** Decodifica lo grabado (en el formato que eligió el navegador), lo deja en WAV mono de 16 kHz y lo manda a transcribir. */
async function transcribirGrabacion(grabado: Blob): Promise<DesenlaceDeTranscripcion> {
  if (grabado.size === 0) return { texto: '', estado: 'error', aviso: avisoDeErrorDeVoz('no-speech', false) };
  const contexto = new AudioContext();
  let wav: Uint8Array;
  try {
    const audio = await contexto.decodeAudioData(await grabado.arrayBuffer());
    wav = prepararWav(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)), audio.sampleRate);
  } finally {
    void contexto.close().catch(() => undefined);
  }
  return desenlaceDeTranscripcion(await transcribirAudio(bytesABase64(wav)));
}

/** Una grabación a la vez. Cada una lleva su número: lo que llegue tarde de una grabación soltada se descarta. */
export class GrabadoraDeVoz {
  private actual: Grabacion | null = null;
  private vuelta = 0;
  private ocupada = false;
  private servicio: boolean;
  private readonly avisos: AvisosDeGrabadora;

  /** `disponible` = el navegador puede grabar; si no, la grabadora nunca empieza. */
  constructor(avisos: AvisosDeGrabadora, disponible: boolean) {
    this.avisos = avisos;
    this.servicio = disponible;
  }

  /** Se puede grabar: el navegador puede y el servidor no dijo que no transcribe (apagado o tope del mes). */
  get conServicio(): boolean {
    return this.servicio;
  }

  /** Ni grabando ni transcribiendo. */
  get libre(): boolean {
    return !this.ocupada;
  }

  empezar(): void {
    if (this.ocupada || !this.servicio) return;
    this.ocupada = true;
    const n = ++this.vuelta;
    void abrirMicrofono().then((m) => this.conMicrofono(m, n));
  }

  private conMicrofono(m: { flujo: MediaStream } | { aviso: string }, n: number): void {
    // Se soltó (o se cerró la pantalla) mientras se pedía el permiso: no se graba nada.
    if (n !== this.vuelta) return 'flujo' in m ? apagarPistas(m.flujo) : undefined;
    if ('aviso' in m) return this.fallar(m.aviso);
    try {
      this.actual = empezarGrabacion(m.flujo, () => this.terminar(true), (grabado) => this.alParar(grabado, n));
      this.avisos.alGrabar();
    } catch {
      apagarPistas(m.flujo);
      this.fallar('No pude iniciar el micrófono. Recarga la página e intenta de nuevo.');
    }
  }

  /** Deja de grabar; lo grabado sale por `onstop` y se transcribe. */
  terminar(porTope: boolean): void {
    const g = this.actual;
    if (!g) return;
    this.actual = null;
    clearTimeout(g.tope);
    if (g.grabadora.state === 'inactive') return this.fallar(AVISO_GRABACION_ILEGIBLE);
    this.avisos.alTranscribir(porTope);
    g.grabadora.stop();
  }

  private alParar(grabado: Blob, n: number): void {
    // Se detuvo sola (p. ej. se desconectó el micrófono): se transcribe lo que alcanzó a grabar y el tope ya no corre.
    if (this.actual && n === this.vuelta) {
      clearTimeout(this.actual.tope);
      this.actual = null;
      this.avisos.alTranscribir(false);
    }
    void this.entregar(grabado, n);
  }

  private async entregar(grabado: Blob, n: number): Promise<void> {
    const d = await transcribirGrabacion(grabado).catch((): DesenlaceDeTranscripcion => ({ texto: '', estado: 'error', aviso: AVISO_GRABACION_ILEGIBLE }));
    if (n !== this.vuelta) return;
    this.ocupada = false;
    // Si el servidor no transcribe, no se vuelve a ofrecer el micrófono en esta pantalla.
    if (d.estado === 'no_disponible') this.servicio = false;
    this.avisos.alResultado(d);
  }

  /** Corta todo sin transcribir y descarta lo que esté en camino. */
  soltar(): void {
    this.vuelta++;
    this.ocupada = false;
    const g = this.actual;
    this.actual = null;
    if (!g) return;
    clearTimeout(g.tope);
    g.grabadora.onstop = null;
    if (g.grabadora.state !== 'inactive') g.grabadora.stop();
    apagarPistas(g.flujo);
  }

  private fallar(aviso: string): void {
    this.ocupada = false;
    this.avisos.alFallar(aviso);
  }
}
