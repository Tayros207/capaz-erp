import { z } from 'zod';
import { exito, type Ayuda, type Criticidad, type Respuesta } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
import { manifiestoCore } from '../modulos/manifiesto-core.js';
import { RegistroDeHerramientas } from './registro.js';
import type {
  ContextoDeHerramienta,
  DatosDeAuditoria,
  HerramientaRegistrada,
  ResultadoDeResumen,
} from './tipos.js';

// Ayudas para las pruebas de quien construye herramientas o cosas que las ejecutan. No agrega
// contratos de prueba a `@capaz/shared`: el contrato va en línea y el registro es uno suelto.

export const AYUDA_DE_PRUEBA: Ayuda = {
  titulo: 'Herramienta de prueba',
  paraQueSirve: 'Sirve para probar el ejecutor.',
  cuandoUsarla: 'Solo en las pruebas.',
  campos: [],
  ejemploTecleado: 'probar',
  ejemploHablado: 'haz la prueba',
  erroresComunes: ['Ninguno.'],
  relacionadas: [],
};

export type DefinicionDeHerramientaDePrueba = {
  nombre: string;
  /** Por defecto `core`. */
  modulo?: string;
  permiso?: string | null;
  /** Por defecto `normal`. */
  criticidad?: Criticidad;
  idempotente?: boolean;
  mueveDinero?: boolean;
  ayuda?: Ayuda;
  /** Por defecto un objeto vacío estricto. */
  entrada?: z.ZodType;
  /** Por defecto acepta cualquier objeto. */
  salida?: z.ZodType;
  resumir?: (args: any, ctx: ContextoDeHerramienta, tx: Transaccion) => Promise<ResultadoDeResumen>;
  auditar?: (args: any, datos: any) => DatosDeAuditoria;
  /** Por defecto responde éxito con `{}`. */
  ejecutar?: (args: any, ctx: ContextoDeHerramienta, tx: Transaccion) => Promise<Respuesta<any>>;
};

/** Una herramienta con su contrato en línea, lista para `registro.agregar([...])`. */
export function herramientaDePrueba(d: DefinicionDeHerramientaDePrueba): HerramientaRegistrada {
  return {
    nombre: d.nombre,
    modulo: d.modulo ?? 'core',
    permiso: d.permiso ?? null,
    criticidad: d.criticidad ?? 'normal',
    idempotente: d.idempotente ?? false,
    mueveDinero: d.mueveDinero ?? false,
    ayuda: d.ayuda ?? AYUDA_DE_PRUEBA,
    entrada: d.entrada ?? z.strictObject({}),
    salida: d.salida ?? z.looseObject({}),
    resumir: d.resumir ?? null,
    auditar: d.auditar ?? null,
    ejecutar: d.ejecutar ?? (async () => exito({})),
  };
}

/** Un `RegistroDeHerramientas` suelto (sin Nest) con las herramientas dadas. No valida contra los contratos. */
export function registroDePrueba(
  herramientas: readonly HerramientaRegistrada[],
  catalogo: CatalogoDeModulos = new CatalogoDeModulos([manifiestoCore]),
): RegistroDeHerramientas {
  const registro = new RegistroDeHerramientas(catalogo);
  registro.agregar(herramientas);
  return registro;
}
