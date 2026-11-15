import { and, eq, inArray, isNull } from 'drizzle-orm';
import { sincronizaciones } from '../../db/esquema/core-conexiones.js';
import { clientes, productos } from '../../db/esquema/core-maestros.js';
import type { ContextoDeEmpresa, Transaccion } from '../../infra/database/con-empresa.js';
import type { ClaveDeFila } from './columnas.js';

// Lecturas de apoyo para detectar duplicados y el registro de la corrida. Las altas NO van por aquí:
// pasan por las herramientas `clientes_crear` y `productos_crear`.

export type Existentes = { nombres: Set<string>; documentos: Set<string>; codigos: Set<string> };

const aTrozos = <T>(v: T[], n = 500): T[][] => Array.from({ length: Math.ceil(v.length / n) }, (_, i) => v.slice(i * n, i * n + n));

/** Qué claves del archivo ya existen en la empresa. Misma regla que las herramientas de creación. */
export async function existentesDe(tx: Transaccion, ctx: ContextoDeEmpresa, entidad: 'clientes' | 'productos', claves: ClaveDeFila[]): Promise<Existentes> {
  const out: Existentes = { nombres: new Set(), documentos: new Set(), codigos: new Set() };
  const nombres = [...new Set(claves.map((c) => c.nombre))];
  if (entidad === 'clientes') {
    const numeros = [...new Set(claves.flatMap((c) => (c.documento ? [c.documento.split(':')[1]!] : [])))];
    const base = and(eq(clientes.tenantId, ctx.empresaId), isNull(clientes.fusionadoEn));
    for (const t of aTrozos(nombres)) {
      for (const f of await tx.select({ n: clientes.nombreNormalizado }).from(clientes).where(and(base, inArray(clientes.nombreNormalizado, t)))) out.nombres.add(f.n);
    }
    for (const t of aTrozos(numeros)) {
      const filas = await tx
        .select({ tipo: clientes.documentoTipo, numero: clientes.documentoNumero })
        .from(clientes)
        .where(and(base, inArray(clientes.documentoNumero, t)));
      for (const f of filas) out.documentos.add(`${f.tipo}:${f.numero}`);
    }
    return out;
  }
  const codigos = [...new Set(claves.flatMap((c) => (c.codigo ? [c.codigo] : [])))];
  const base = eq(productos.tenantId, ctx.empresaId);
  // El nombre solo choca con productos activos; el código, con cualquiera.
  for (const t of aTrozos(nombres)) {
    for (const f of await tx.select({ n: productos.nombreNormalizado }).from(productos).where(and(base, isNull(productos.archivadoEn), inArray(productos.nombreNormalizado, t)))) out.nombres.add(f.n);
  }
  for (const t of aTrozos(codigos)) {
    for (const f of await tx.select({ c: productos.codigo }).from(productos).where(and(base, inArray(productos.codigo, t)))) if (f.c) out.codigos.add(f.c);
  }
  return out;
}

/** Deja el resultado de la importación en `core.sincronizaciones` (conector «archivo»). */
export async function registrarImportacion(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  d: { entidad: string; total: number; procesados: number; errores: { fila: number; motivo: string }[]; inicio: Date },
): Promise<string> {
  const [fila] = await tx
    .insert(sincronizaciones)
    .values({
      tenantId: ctx.empresaId,
      conector: 'archivo',
      tipo: 'importar',
      entidad: d.entidad,
      estado: d.errores.length > 0 ? 'con_errores' : 'ok',
      total: d.total,
      procesados: d.procesados,
      errores: d.errores,
      iniciadoPor: ctx.usuarioId,
      iniciadoEn: d.inicio,
      terminadoEn: new Date(),
    })
    .returning({ id: sincronizaciones.id });
  return fila!.id;
}
