import { describe, expect, it } from 'vitest';
import * as contratos from './index.js';
import { CONTRATOS, CONTRATOS_DE_PLATAFORMA, EVENTOS } from './index.js';

const AREAS = [
  'Empresa', 'Modulos', 'Auditoria', 'Miembros', 'Clientes', 'Productos', 'Sucursales', 'Borradores', 'Conexiones',
  'Automatizaciones', 'Intercambio', 'Plataforma', 'Registro', 'Crm', 'Ordenes', 'Insumos', 'Compras', 'Personal',
  'Reportes', 'Cotizador',
];

describe('contratos por área', () => {
  it('cada una de las 20 áreas exporta sus contratos y sus eventos', () => {
    const todo = contratos as Record<string, unknown>;
    for (const a of AREAS) {
      expect(todo[`contratosDe${a}`], `contratosDe${a}`).toBeTypeOf('object');
      expect(todo[`eventosDe${a}`], `eventosDe${a}`).toBeTypeOf('object');
    }
  });

  it('ningún nombre de herramienta ni de evento se repite entre áreas', () => {
    const todo = contratos as Record<string, Record<string, unknown>>;
    const vistos = new Map<string, string>();
    for (const a of AREAS) {
      for (const prefijo of ['contratosDe', 'eventosDe']) {
        for (const nombre of Object.keys(todo[`${prefijo}${a}`] ?? {})) {
          const clave = `${prefijo === 'contratosDe' ? 'h' : 'e'}:${nombre}`;
          expect(vistos.has(clave), `«${nombre}» está en ${vistos.get(clave)} y en ${a}`).toBe(false);
          vistos.set(clave, a);
        }
      }
    }
    expect(Object.keys({ ...CONTRATOS, ...CONTRATOS_DE_PLATAFORMA })).toHaveLength(Object.keys(CONTRATOS).length + Object.keys(CONTRATOS_DE_PLATAFORMA).length);
    expect(EVENTOS).toBeTypeOf('object');
  });

  it('los nombres cumplen las convenciones', () => {
    for (const n of [...Object.keys(CONTRATOS), ...Object.keys(CONTRATOS_DE_PLATAFORMA)]) expect(n).toMatch(/^[a-z][a-z0-9]*_[a-z0-9_]+$/);
    for (const n of Object.keys(EVENTOS)) expect(n).toMatch(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
  });
});

describe('eventos de la ola 3', () => {
  const ok = {
    'compra.enviada': { ordenId: 'o', numero: 'OC-1', proveedorId: 'p', totalCentimos: 100 },
    'compra.recibida': { ordenId: 'o', recepcionId: 'r', numero: 'OC-1', proveedorId: 'p', totalRecibidoCentimos: 100, lineas: [{ productoId: null, cantidadMilesimas: 1000, costoUnitarioMilesimas: 500 }] },
    'compra.cancelada': { ordenId: 'o', numero: 'OC-1' },
    'existencia.bajo_minimo': { articuloId: 'a', sucursalId: 's', cantidadMilesimas: 1, minimoMilesimas: 5 },
    'existencia.movida': { articuloId: 'a', sucursalId: 's', tipo: 'salida', cantidadMilesimas: -1000 },
    'adelanto.registrado': { adelantoId: 'a', colaboradorId: 'c', montoCentimos: 5000, fecha: '2026-11-16' },
    'adelanto.anulado': { adelantoId: 'a', colaboradorId: 'c', montoCentimos: 5000 },
  } as const;

  it('están registrados, aceptan su carga y rechazan campos de más', () => {
    for (const [nombre, carga] of Object.entries(ok)) {
      const esquema = (EVENTOS as Record<string, { safeParse: (v: unknown) => { success: boolean } }>)[nombre];
      expect(esquema, nombre).toBeDefined();
      expect(esquema!.safeParse(carga).success, nombre).toBe(true);
      expect(esquema!.safeParse({ ...carga, nombre: 'x' }).success, `${nombre} strict`).toBe(false);
    }
  });
});
