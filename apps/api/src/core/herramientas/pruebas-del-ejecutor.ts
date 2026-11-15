import { z } from 'zod';
import { exito, rechazo, type AccesoDeModulo, type Respuesta } from '@capaz/shared';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { comoEmpresa, conEmpresaDePruebas, empresaDePrueba, type abrirPool } from '../../pruebas/base-de-pruebas.js';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { EscritorDeAuditoria } from '../auditoria/escritor.js';
import { EjecutorDeHerramientas } from './ejecutor.js';
import { herramientaDePrueba, registroDePrueba } from './pruebas.js';
import type { ContextoDeHerramienta, HerramientaRegistrada } from './tipos.js';

// Armado común de las pruebas de integración del ejecutor: herramientas falsas (esta capa se prueba
// sin nada de negocio) contra la base real, con un registro suelto y la transacción real.

export const SECRETO = 'un-secreto-de-prueba-de-al-menos-32-caracteres';

export const acceso = (codigo: string, extra: Partial<AccesoDeModulo> = {}): AccesoDeModulo => ({
  codigo,
  visible: true,
  motivo: 'activo',
  puedeEntrar: true,
  puedeEscribir: true,
  nivel: 'completo',
  alcance: 'todos',
  diasDePrueba: null,
  ...extra,
});

export const TODOS = ['cotizacion:ver', 'cotizacion:editar', 'cotizacion:emitir', 'costos:ver'];

export function contextoDePrueba(empresaId: string, cambios: Partial<ContextoDeHerramienta> = {}): ContextoDeHerramienta {
  return {
    requestId: 'req-de-prueba',
    empresaId,
    usuarioId: 'u1',
    rol: 'owner',
    permisos: TODOS,
    modulos: [acceso('core'), acceso('registro')],
    canal: 'ui',
    ...cambios,
  };
}

/** Un cambio real en la base (una fila en `confirmaciones_usadas`) para comprobar qué se revierte. */
export const marcar = (tx: Parameters<NonNullable<HerramientaRegistrada['ejecutar']>>[2], empresaId: string, marca: string) =>
  tx.execute(sql`insert into core.confirmaciones_usadas (tenant_id, jti) values (${empresaId}, ${marca})`);

export type Entorno = {
  empresaId: string;
  ejecutor: EjecutorDeHerramientas;
  estado: { version: number; ejecuciones: string[] };
  reloj: { ahora: Date };
  ctx: (cambios?: Partial<ContextoDeHerramienta>) => ContextoDeHerramienta;
  llamar: (nombre: string, args: unknown, cambios?: Partial<ContextoDeHerramienta>) => Promise<Respuesta<unknown>>;
  auditoria: () => Promise<Record<string, any>[]>;
  marcas: () => Promise<string[]>;
};


export function herramientasDeEjemplo(estado: Entorno['estado']): HerramientaRegistrada[] {
  const peligrosa = (nombre: string) =>
    herramientaDePrueba({
      nombre,
      criticidad: 'critica',
      permiso: 'cotizacion:emitir',
      entrada: z.strictObject({ motivo: z.string().optional(), nota: z.string().optional() }),
      salida: z.strictObject({ hecho: z.boolean() }),
      resumir: async (a) =>
        a.motivo === 'impedido'
          ? { ok: false, error: { codigo: 'conflicto', mensaje: 'Falta algo para poder hacerlo.' } }
          : { ok: true, resumen: { resumen: `¿Hago ${nombre}?`, huella: `v${estado.version}` } },
      ejecutar: async () => {
        estado.ejecuciones.push(nombre);
        return exito({ hecho: true });
      },
    });
  return [
    herramientaDePrueba({
      nombre: 'eco',
      criticidad: 'lectura',
      entrada: z.strictObject({ texto: z.string().trim().min(1) }),
      salida: z.strictObject({ texto: z.string() }),
      ejecutar: async (a) => {
        estado.ejecuciones.push('eco');
        return exito(
          { texto: a.texto },
          {
            recibo: { comercial: { precio: '10.00' }, interno: { costo: '6.00' } },
            avisos: [
              { codigo: 'publico', mensaje: 'Aviso público', nivel: 'comercial' },
              { codigo: 'privado', mensaje: 'Aviso con el margen', nivel: 'interno' },
            ],
          },
        );
      },
    }),
    herramientaDePrueba({
      nombre: 'editar',
      permiso: 'cotizacion:editar',
      entrada: z.strictObject({ valor: z.string() }),
      salida: z.strictObject({ valor: z.string() }),
      ejecutar: async (a) => {
        estado.ejecuciones.push('editar');
        return a.valor === 'malo' ? rechazo('conflicto', 'Ese valor no sirve.') : exito({ valor: a.valor });
      },
    }),
    peligrosa('emitir'),
    peligrosa('anular'),
    herramientaDePrueba({
      nombre: 'explota',
      criticidad: 'lectura',
      ejecutar: async () => {
        throw new Error('detalle interno que no debe salir: clave-secreta-123');
      },
    }),
    herramientaDePrueba({
      nombre: 'salida_mala',
      criticidad: 'lectura',
      salida: z.strictObject({ ok: z.boolean() }),
      ejecutar: async () => exito({ ok: true, costoTotal: '6.00' }),
    }),
    herramientaDePrueba({
      nombre: 'pide_sola',
      criticidad: 'lectura',
      ejecutar: async () => ({ ok: false, requiereConfirmacion: { resumen: 'x', token: 'falso', venceEn: 'ya' } }),
    }),
  ];
}

/** Ejecutor real sobre la base de pruebas, con `extra` como herramientas adicionales. */
export function crearEntorno(pool: ReturnType<typeof abrirPool>, extra: (e: Entorno) => HerramientaRegistrada[] = () => []): Entorno {
  const empresaId = empresaDePrueba();
  const estado = { version: 1, ejecuciones: [] as string[] };
  const reloj = { ahora: new Date('2026-09-19T12:00:00.000Z') };
  const db = { conEmpresa: conEmpresaDePruebas(pool) } as unknown as DatabaseService;
  const registro = registroDePrueba([]);
  const ejecutor = new EjecutorDeHerramientas(
    registro,
    db,
    new EscritorDeAuditoria(db),
    { CONFIRMACION_SECRET: SECRETO },
    { error: () => undefined } as unknown as Logger,
  );
  let jtis = 0;
  ejecutor.reloj = () => reloj.ahora;
  ejecutor.nuevoJti = () => `jti-${empresaId}-${++jtis}`;
  const ctx = (cambios: Partial<ContextoDeHerramienta> = {}) => contextoDePrueba(empresaId, cambios);
  const entorno: Entorno = {
    empresaId,
    ejecutor,
    estado,
    reloj,
    ctx,
    llamar: (nombre, args, cambios) => ejecutor.ejecutar(nombre, args, { ctx: ctx(cambios) }),
    auditoria: () =>
      comoEmpresa(pool, empresaId, async (c) =>
        (await c.query('select * from core.auditoria order by creado_en, id')).rows,
      ),
    marcas: () =>
      comoEmpresa(pool, empresaId, async (c) =>
        (await c.query('select jti from core.confirmaciones_usadas order by jti')).rows.map((r) => r.jti as string),
      ),
  };
  registro.agregar([...herramientasDeEjemplo(estado), ...extra(entorno)]);
  return entorno;
}

export const codigoDe = (r: Respuesta<unknown>): string | undefined => (!r.ok && 'error' in r ? r.error.codigo : undefined);
