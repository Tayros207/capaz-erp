import { centimosSchema, exito } from '@capaz/shared';
import type { CatalogoDeModulos } from '../modulos/catalogo.js';
import { AYUDAS } from './ayudas.js';
import { isoObligatoria } from './repositorio.js';
import { definirHerramientaDePlataforma, type HerramientaDePlataformaRegistrada } from './tipos.js';

// Lecturas de la consola sobre el catálogo de módulos y los vencimientos (A5 y A7). Solo contratos y cifras.

export function herramientasDeCatalogo(catalogo: Pick<CatalogoDeModulos, 'contratables'>): HerramientaDePlataformaRegistrada[] {
  const modulos = definirHerramientaDePlataforma('plataforma_modulos_listar', {
    criticidad: 'lectura',
    ayuda: AYUDAS.modulosListar,
    ejecutar: async () =>
      exito({
        items: catalogo.contratables().map((m) => ({
          codigo: m.codigo,
          nombre: m.nombre,
          familia: m.familia ?? '',
          descripcion: m.descripcion,
          enConstruccion: m.enConstruccion,
          porDefecto: !!m.porDefecto,
          dependeDe: [...m.dependeDe],
        })),
      }),
  });

  const vencimientos = definirHerramientaDePlataforma('plataforma_vencimientos_listar', {
    criticidad: 'lectura',
    ayuda: AYUDAS.vencimientosListar,
    async ejecutar(a, _ctx, db) {
      const { rows } = await db.query<{
        empresa: string; empresa_nombre: string; modulo: string; modulo_nombre: string; tipo: 'prueba' | 'contrato'; fecha: Date; dias: number; precio: string | null;
      }>(
        `select v.tenant_id as empresa, e.nombre as empresa_nombre, v.modulo, c.nombre as modulo_nombre, v.tipo, v.fecha,
                ceil(extract(epoch from (v.fecha - now())) / 86400)::int as dias, v.precio
           from (
             select tenant_id, modulo, 'prueba' as tipo, prueba_hasta as fecha, precio_acordado_centimos::text as precio
               from core.empresa_modulos where estado = 'prueba' and prueba_hasta > now() and prueba_hasta <= now() + make_interval(days => $1)
             union all
             select tenant_id, modulo, 'contrato', vigente_hasta, precio_acordado_centimos::text
               from core.empresa_modulos where estado in ('activo', 'prueba') and vigente_hasta > now() and vigente_hasta <= now() + make_interval(days => $1)
           ) v
           join core.v_empresas_plataforma e on e.empresa_id = v.tenant_id
           join core.modulos c on c.codigo = v.modulo
          order by v.fecha, e.nombre, v.modulo limit 500`,
        [a.dias],
      );
      const ids = [...new Set(rows.map((r) => r.empresa))];
      const { rows: ingresos } = await db.query<{ tenant_id: string; total: string }>(
        `select tenant_id, coalesce(sum(precio_acordado_centimos), 0)::text as total from core.empresa_modulos
          where tenant_id = any($1::text[]) and estado in ('activo', 'prueba') and (vigente_hasta is null or vigente_hasta > now())
          group by tenant_id`,
        [ids],
      );
      const porEmpresa = ids.map((id) => {
        const fila = rows.find((r) => r.empresa === id)!;
        return {
          empresa: id,
          empresaNombre: fila.empresa_nombre,
          vencimientos: rows.filter((r) => r.empresa === id).length,
          ingresoMensualAcordadoCentimos: centimosSchema.parse(Number(ingresos.find((i) => i.tenant_id === id)?.total ?? 0)),
        };
      });
      return exito({
        dias: a.dias,
        items: rows.map((r) => ({
          empresa: r.empresa,
          empresaNombre: r.empresa_nombre,
          modulo: r.modulo,
          moduloNombre: r.modulo_nombre,
          tipo: r.tipo,
          fecha: isoObligatoria(r.fecha),
          diasRestantes: r.dias,
          precioAcordadoCentimos: r.precio === null ? null : centimosSchema.parse(Number(r.precio)),
        })),
        porEmpresa,
        ingresoMensualAcordadoCentimos: centimosSchema.parse(porEmpresa.reduce((s, e) => s + e.ingresoMensualAcordadoCentimos, 0)),
      });
    },
    auditar: (a) => ({ resumen: { dias: a.dias } }),
  });

  return [modulos, vencimientos];
}
