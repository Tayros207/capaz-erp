import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { FuenteDeTiempo } from '../../core/automatizaciones/tipos.js';
import { instanteDeDia } from '../../core/empresas/hoy.js';
import { registroDeudas } from '../../db/esquema/registro.js';
import { codigoDeDeuda, type TipoDeDeuda } from './domain/codigos.js';

// Fuentes de tiempo del módulo (ficha §4.5): fechas sobre las que una regla puede decir «N días antes o después».
// No escriben: solo entregan candidatos. La empresa la fija la transacción (RLS).

/** El vencimiento de cada deuda abierta (`pendiente` o `parcial`). Sin datos personales: ids, código e importes. */
export const deudaVence: FuenteDeTiempo = {
  clave: 'registro.deuda_vence',
  modulo: 'registro',
  descripcion: 'Una cuenta por cobrar o por pagar llega a su fecha de vencimiento.',
  async candidatos(tx) {
    const d = registroDeudas;
    const filas = await tx
      .select({ id: d.id, tipo: d.tipo, anio: d.anio, numero: d.numero, contactoId: d.contactoId, total: d.totalCentimos, abonado: d.abonadoCentimos, venceEn: d.venceEn })
      .from(d)
      .where(and(eq(d.tenantId, sql`current_setting('app.tenant_id', true)`), inArray(d.estado, ['pendiente', 'parcial']), isNotNull(d.venceEn)));
    return filas.map((f) => ({
      entidadTipo: 'deuda',
      entidadId: f.id,
      fecha: instanteDeDia(f.venceEn!),
      datos: {
        id: f.id,
        codigo: codigoDeDeuda(f.tipo as TipoDeDeuda, f.anio, f.numero),
        tipo: f.tipo,
        contactoId: f.contactoId,
        saldoCentimos: f.total - f.abonado,
        venceEn: f.venceEn,
      },
    }));
  },
};

export const FUENTES_DE_REGISTRO: readonly FuenteDeTiempo[] = [deudaVence];
