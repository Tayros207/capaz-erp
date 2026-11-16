import { sql } from 'drizzle-orm';
import type { FuenteDeTiempo } from '../../core/automatizaciones/tipos.js';
import { instanteDeDia } from '../../core/empresas/hoy.js';
import { codigoDeOportunidad } from './domain/oportunidad.js';

// Fuentes de tiempo de `crm` (FICHAS-OLA-2 §5.3). Corren dentro de `conEmpresa`: la RLS limita a la empresa. Solo leen.

type FilaDeActividad = { id: string; oportunidad_id: string; anio: number; numero: number; asunto: string; tipo: string; vence_el: string };
type FilaDeOportunidad = { id: string; anio: number; numero: number; titulo: string; cliente_id: string; etapa_id: string; ultima_actividad_en: Date | string };

export const actividadVence: FuenteDeTiempo = {
  clave: 'crm.actividad_vence',
  modulo: 'crm',
  descripcion: 'Vence una actividad de seguimiento que aún no está hecha.',
  async candidatos(tx) {
    const r = await tx.execute<FilaDeActividad>(sql`
      select a.id, a.oportunidad_id, o.anio, o.numero, a.asunto, a.tipo, a.vence_el::text as vence_el
        from crm.actividades a
        join crm.oportunidades o on o.tenant_id = a.tenant_id and o.id = a.oportunidad_id
       where a.hecha_en is null and a.vence_el is not null`);
    return r.rows.map((f) => ({
      entidadTipo: 'actividad',
      entidadId: f.id,
      fecha: instanteDeDia(f.vence_el),
      datos: { id: f.id, oportunidadId: f.oportunidad_id, oportunidadCodigo: codigoDeOportunidad(f.anio, f.numero), asunto: f.asunto, tipo: f.tipo },
    }));
  },
};

export const oportunidadSinMovimiento: FuenteDeTiempo = {
  clave: 'crm.oportunidad_sin_movimiento',
  modulo: 'crm',
  descripcion: 'Una oportunidad abierta lleva tiempo sin movimiento.',
  async candidatos(tx) {
    const r = await tx.execute<FilaDeOportunidad>(sql`
      select id, anio, numero, titulo, cliente_id, etapa_id, ultima_actividad_en from crm.oportunidades where estado = 'abierta'`);
    return r.rows.map((f) => ({
      entidadTipo: 'oportunidad',
      entidadId: f.id,
      fecha: new Date(f.ultima_actividad_en),
      datos: { id: f.id, codigo: codigoDeOportunidad(f.anio, f.numero), titulo: f.titulo, clienteId: f.cliente_id, etapaId: f.etapa_id },
    }));
  },
};

export const FUENTES_DE_CRM: readonly FuenteDeTiempo[] = [actividadVence, oportunidadSinMovimiento];
