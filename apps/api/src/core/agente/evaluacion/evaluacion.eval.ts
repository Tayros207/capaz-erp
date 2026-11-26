import { mkdirSync, writeFileSync } from 'node:fs';
import { exito, rechazo } from '@capaz/shared';
import { CONFIG, type Config } from '../../../infra/config/config.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { mensajeDeZod, OPCIONES_EN_ESPANOL } from '../../herramientas/errores-de-zod.js';
import { abrirSesion, crearEmpresa } from '../../herramientas/http-de-pruebas.js';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../../herramientas/tipos.js';
import { ServicioDeAcceso } from '../../modulos/acceso.service.js';
import { correrTurno } from '../bucle.js';
import { ModeloDeOpenRouter } from '../modelo-de-openrouter.js';
import { armarPrompt } from '../prompt.js';
import type { ModeloDeChat } from '../modelo-de-chat.js';
import type { DependenciasDelBucle } from '../tipos-del-turno.js';
import { CLIENTES, ESCENARIOS, type Escenario, type Llamada } from './escenarios.js';

// Corre cada escenario con el bucle, el prompt y las herramientas REALES; el ejecutor es de mentira: valida los argumentos con el
// mismo esquema del sistema, anota la llamada y devuelve datos inventados. No toca datos de nadie.

// Cuántas veces se repite cada escenario con cada modelo. Sube las repeticiones si quieres un resultado más firme (cuesta más).
const MODELOS: readonly { id: string; veces: number }[] = [
  { id: 'anthropic/claude-sonnet-5.5', veces: 1 },
  { id: 'anthropic/claude-haiku-5.5', veces: 1 },
  { id: 'deepseek/deepseek-v4.1-flash-1017', veces: 1 },
  { id: 'deepseek/deepseek-v4-pro-0813', veces: 1 },
];
/** Tope de gasto de UNA corrida: al llegar no se llama más al modelo. Una corrida completa costó ~US$ 0.30 (2026-11-26). */
const TOPE_MICROUSD = 600_000;
/** Los resultados completos (con lo que cada modelo mandó en crudo) quedan aquí, fuera de git. */
const CARPETA = new URL('../../../../node_modules/.cache/eval-asistente/', import.meta.url);
let gasto = 0;

let app: AppDePruebas;
let ctx: ContextoDeHerramienta;

beforeAll(async () => {
  mkdirSync(CARPETA, { recursive: true });
  app = await levantarApp({ alta: 'abierta' });
  const dueno = await abrirSesion(app, 'Evaluación');
  const empresa = await crearEmpresa(dueno, 'Imprenta de evaluación');
  const base = (await app.obtener(ServicioDeAcceso).contextoDe(empresa, dueno.usuarioId, 'ui', 'eval'))!;
  const todas = app.obtener(RegistroDeHerramientas).todas();
  // Una empresa con todo activo: así el modelo elige entre las mismas herramientas que la más completa.
  ctx = {
    ...base,
    canal: 'agente',
    permisos: [...new Set(todas.map((h) => h.permiso).filter((p): p is string => p !== null))] as ContextoDeHerramienta['permisos'],
    modulos: [...new Set(todas.map((h) => h.modulo))].map((codigo) => ({ ...base.modulos[0]!, codigo, puedeEntrar: true, puedeEscribir: true })),
  };
});
afterAll(async () => {
  await app.cerrar();
});

const CREADO = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c99';

/** Lo que «devuelve el sistema» si el escenario no dice otra cosa. Ver algo recién creado devuelve lo que se mandó al crearlo. */
function porOmision(nombre: string, lectura: boolean, args: unknown, llamadas: Llamada[]): unknown {
  if (nombre === 'clientes_buscar') return CLIENTES;
  if (!lectura) return { id: CREADO, estado: 'borrador', ...(args as object) };
  if (nombre.endsWith('_ver') && nombre !== 'mi_dia_ver') {
    const creada = llamadas.filter((l) => l.ok && l.herramienta.endsWith('_crear')).at(-1);
    return { id: CREADO, estado: 'borrador', ...creada?.args };
  }
  return { items: [], siguiente: null };
}

/** Anota lo que el modelo pide, tal cual lo manda: así se ve por qué falla. */
function conCrudos(modelo: ModeloDeChat, crudos: string[]): ModeloDeChat {
  return {
    async *conversar(p) {
      for await (const t of modelo.conversar(p)) {
        if (t.tipo === 'fin') for (const l of t.llamadas) crudos.push(`${l.function.name} ${l.function.arguments}`.slice(0, 600));
        yield t;
      }
    },
  };
}

function dependencias(e: Escenario, llamadas: Llamada[], crudos: string[], config: Config): DependenciasDelBucle {
  const registro = app.obtener(RegistroDeHerramientas);
  const atender = async (nombre: string, args: unknown) => {
    const h = registro.obtener(nombre)!;
    const parseo = h.entrada.safeParse(args, OPCIONES_EN_ESPANOL);
    llamadas.push({ herramienta: nombre, args: (parseo.success ? parseo.data : args) as Record<string, unknown>, ok: parseo.success });
    if (!parseo.success) return rechazo('argumentos_invalidos', mensajeDeZod(parseo.error));
    const datos = e.datos?.[nombre] ?? porOmision(nombre, h.criticidad === 'lectura', args, llamadas);
    return exito(datos);
  };
  return {
    modelo: conCrudos(new ModeloDeOpenRouter({ apiKey: config.OPENROUTER_API_KEY!, razonamiento: config.AGENTE_RAZONAMIENTO }), crudos),
    registro,
    ejecutar: (nombre, args) => atender(nombre, args),
    proponer: async (nombre, args) => {
      await atender(nombre, args);
      return exito({ borradores: [] });
    },
    huella: { aparte: async () => undefined, hayIdentica: async () => false, acumuladoDelDia: async () => 0, hayPropuestaDelSistema: async () => false },
    limitesDeDinero: { dineroDirecto: true, topePorOperacionCentimos: 100_000, hoy: new Date().toISOString().slice(0, 10) },
    emitir: () => undefined,
    anotar: async () => undefined,
    permitirRonda: async (delTurno) => gasto + delTurno < TOPE_MICROUSD,
    reloj: () => Date.now(),
  };
}

async function correr(e: Escenario, modelo: string) {
  const config = app.obtener<Config>(CONFIG);
  const llamadas: Llamada[] = [];
  const crudos: string[] = [];
  const prompt = armarPrompt({ empresa: 'Imprenta de evaluación', moneda: 'PEN', zona: 'America/Lima', modulos: ctx.modulos.filter((m) => m.codigo !== 'core').map((m) => ({ nombre: m.codigo, puedeEscribir: true })), modo: 'directa', ahora: new Date(), rol: 'owner', pantalla: e.pantalla ? { nombreDeModulo: e.pantalla.modulo, entidad: null } : null, internet: false });
  const r = await correrTurno(dependencias(e, llamadas, crudos, config), {
    turnoId: crypto.randomUUID(), ctx, modelo, modo: 'directa', pantalla: e.pantalla ?? null, origen: 'texto', prompt, historial: [], mensaje: e.mensaje, maxRondas: 12, senal: AbortSignal.timeout(150_000), sesion: `eval-${e.id}`,
  });
  gasto += r.uso.costoMicrousd;
  const juicio = e.fallo({ llamadas, texto: r.texto });
  const fallo = r.estado === 'completo' ? juicio : `${juicio ?? 'hecho, pero'} · turno ${r.estado}: ${r.mensajeDeError ?? r.corte ?? ''}`;
  return { escenario: e.id, modelo, fallo, malas: r.herramientas.filter((h) => !h.ok).length, llamadas: r.herramientas.map((h) => `${h.ok ? '' : '✗'}${h.nombre}`), ...r.uso, texto: r.texto.slice(0, 300), crudos };
}

type Fila = Awaited<ReturnType<typeof correr>>;

function resumir(modelo: string, filas: Fila[]): string {
  const media = (k: 'rondas' | 'tokensEntrada' | 'tokensCache' | 'costoMicrousd' | 'malas') => filas.reduce((s, f) => s + f[k], 0) / filas.length;
  return `RESUMEN ${modelo.split('/')[1]}: ${filas.filter((f) => !f.fallo).length}/${filas.length} bien · rondas ${media('rondas').toFixed(1)} · llamadas fallidas ${media('malas').toFixed(2)} · ent ${media('tokensEntrada').toFixed(0)} (cache ${media('tokensCache').toFixed(0)}) · US$ ${(media('costoMicrousd') / 1e6).toFixed(5)}/turno`;
}

async function correrModelo(m: (typeof MODELOS)[number]): Promise<void> {
  const filas: Fila[] = [];
  for (let vez = 0; vez < m.veces; vez += 1) {
    for (const e of ESCENARIOS) {
      if (gasto >= TOPE_MICROUSD) throw new Error('Se alcanzó el tope de gasto de la evaluación.');
      const f = await correr(e, m.id);
      filas.push(f);
      console.log(`${m.id.split('/')[1]} · ${e.id} · ${f.fallo ?? 'OK'} · rondas ${f.rondas} · ent ${f.tokensEntrada} (cache ${f.tokensCache}) · sal ${f.tokensSalida} · US$ ${(f.costoMicrousd / 1e6).toFixed(5)} · ${f.llamadas.join(',')}`);
      if (f.fallo) console.log(f.crudos.slice(-3).map((c) => `      ↳ ${c}`).join('\n'));
    }
  }
  writeFileSync(new URL(`resultados-${m.id.split('/')[1]}-${Date.now()}.json`, CARPETA), JSON.stringify(filas, null, 1));
  console.log(resumir(m.id, filas));
}

it('banco del asistente', async () => {
  await Promise.all(MODELOS.map(correrModelo));
  console.log(`Gasto de esta corrida: US$ ${(gasto / 1e6).toFixed(4)}`);
});
