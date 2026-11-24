import type { EventoDelAgente, ModoDeEscritura, MotivoDeErrorDelAgente, PantallaDelAgente, Respuesta, UsoDelTurno } from '@capaz/shared';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';
import type { ModeloDeChat, MensajeDeModelo } from './modelo-de-chat.js';
import type { ListaDeAnotaciones } from './repositorio.js';

// Los tipos del bucle del turno. Todo lo que toca el mundo (modelo, ejecutor, base, reloj) entra por `DependenciasDelBucle`:
// así el bucle se prueba entero con un modelo de guion y un ejecutor falso, sin red ni base de datos.

export type RegistroDelBucle = {
  todas(): readonly HerramientaRegistrada[];
  obtener(nombre: string): HerramientaRegistrada | undefined;
};

export type PoliticaDeEjecucion = 'directo' | 'dinero' | 'confirmada';
export type OpcionesDeEjecucionDelBucle = {
  ctx: ContextoDeHerramienta;
  claveDeIdempotencia: string;
  ronda: number;
  indice: number;
  politica: PoliticaDeEjecucion;
  /** Solo la confirmación propia de una acción crítica: el token lo guarda el bucle, el modelo nunca lo ve. */
  confirmacion?: string;
};
export type EjecutorDelBucle = (nombre: string, args: unknown, opciones: OpcionesDeEjecucionDelBucle) => Promise<Respuesta<unknown>>;

/** Propone un borrador en lugar de ejecutar (fase 3). Sin esta dependencia, lo que sería un borrador se rechaza. */
export type ProponerDelBucle = (nombre: string, args: unknown, ctx: ContextoDeHerramienta) => Promise<Respuesta<unknown>>;

/** Una fila de la huella del asistente que NO nace de una ejecución con éxito (esa la escribe el ejecutor en su transacción). */
export type FilaDeHuella = {
  ronda: number;
  indice: number;
  herramienta: string;
  politica: 'directo' | 'confirmada' | 'propuesta';
  resultado: 'rechazada' | 'pendiente_confirmacion' | 'propuesta';
  codigo: string | null;
  hashArgs: string;
  args: unknown;
  resumenConfirmado: string | null;
};

export type HuellaDelBucle = {
  aparte: (fila: FilaDeHuella) => Promise<void>;
  /** ¿La misma persona hizo esta misma operación (misma clave de negocio) con éxito hace pocos minutos? */
  hayIdentica: (herramienta: string, args: unknown) => Promise<boolean>;
  /** Céntimos que el asistente ya movió en las últimas 24 horas por esta persona. */
  acumuladoDelDia: () => Promise<number>;
  /** ¿Hay en la Bandeja una propuesta del sistema (no del asistente) parecida: misma herramienta y mismo cliente u origen? */
  hayPropuestaDelSistema: (herramienta: string, args: unknown) => Promise<boolean>;
};

/** Los límites de dinero de ESTA empresa en ESTE turno. */
export type LimitesDeDinero = { dineroDirecto: boolean; topePorOperacionCentimos: number; hoy: string };

export type DependenciasDelBucle = {
  modelo: ModeloDeChat;
  ejecutar: EjecutorDelBucle;
  registro: RegistroDelBucle;
  proponer?: ProponerDelBucle;
  huella?: HuellaDelBucle;
  limitesDeDinero?: LimitesDeDinero;
  emitir: (evento: EventoDelAgente) => void;
  /** Guarda en cuanto ocurre una acción, un borrador o una herramienta (así un turno cortado deja rastro). */
  anotar: (clave: ListaDeAnotaciones, elemento: unknown) => Promise<void>;
  /**
   * ¿Se puede dar otra ronda? Se pregunta antes de cada ronda desde la segunda, con lo que ya costó ESTE turno: ese gasto todavía
   * no está en el uso guardado, y un turno no debe poder pasarse del tope mensual por no mirarse durante su ejecución.
   */
  permitirRonda: (costoDelTurnoMicrousd: number) => Promise<boolean>;
  /** Milisegundos; se inyecta para medir la duración y para probar. */
  reloj: () => number;
};

export type EntradaDelBucle = {
  turnoId: string;
  /** Con `canal` ya en `'agente'`: el bucle nunca lo cambia ni lo recibe del modelo. */
  ctx: ContextoDeHerramienta;
  modelo: string;
  modo: ModoDeEscritura;
  pantalla: PantallaDelAgente | null;
  origen: 'texto' | 'voz';
  prompt: { fijo: string; variable: string };
  /** Mensajes anteriores de la conversación, solo texto. */
  historial: readonly { role: 'user' | 'assistant'; content: string }[];
  mensaje: string;
  maxRondas: number;
  /** Se aborta al pasar el tiempo máximo del turno. */
  senal: AbortSignal;
  sesion: string;
};

export type CorteDelTurno = 'rondas' | 'tiempo' | 'tope' | 'error';

export type IntentoDeHerramienta = { nombre: string; ok: boolean; codigo: string | null; claves: string[] };

export type ResultadoDeTurno = {
  texto: string;
  estado: 'completo' | 'interrumpido' | 'error';
  corte: CorteDelTurno | null;
  /** Solo si `estado` es `error` o `interrumpido`. */
  motivo: MotivoDeErrorDelAgente | null;
  mensajeDeError: string | null;
  uso: UsoDelTurno;
  herramientas: { nombre: string; ok: boolean }[];
  acciones: { herramienta: string; titulo: string; entidadTipo: string | null; entidadId: string | null }[];
  borradores: { id: string; herramienta: string; resumen: string; critica: boolean }[];
  /** Cada llamada a una herramienta de negocio, en orden: de aquí salen las lecciones («falló y se corrigió»). Sin valores, solo nombres de campos. */
  intentos: IntentoDeHerramienta[];
};

/** Lo que se va acumulando durante el turno. */
export type EstadoDelTurno = {
  texto: string;
  corte: CorteDelTurno | null;
  uso: { entrada: number; salida: number; cache: number; costoMicrousd: number; rondas: number };
  herramientas: ResultadoDeTurno['herramientas'];
  acciones: ResultadoDeTurno['acciones'];
  borradores: ResultadoDeTurno['borradores'];
  intentos: IntentoDeHerramienta[];
  /** Frenos del turno: cuántas escrituras y cuántas de dinero se hicieron, y cuáles ya se vieron (nombre + argumentos). */
  escrituras: number;
  escriturasDeDinero: number;
  vistas: Set<string>;
  /** Confirmaciones propias pendientes: llave (herramienta + argumentos) → token y ronda en que se pidió. */
  confirmaciones: Map<string, { token: string; ronda: number }>;
};

export type ContextoDeLlamada = {
  dep: DependenciasDelBucle;
  entrada: EntradaDelBucle;
  estado: EstadoDelTurno;
  ronda: number;
  indice: number;
};

export type MensajesDelBucle = MensajeDeModelo[];
