import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type RespuestaHttp, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';

// Reportes por HTTP real: compone los `<codigo>_resumen` de los módulos accesibles, sin leer sus tablas.

const MODULOS = ['reportes', 'registro', 'ordenes', 'crm', 'insumos', 'personal'];
let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let parcial: Sesion; // reportes completo + solo ordenes
let lector: Sesion; // reportes en lectura + ordenes
let propio: Sesion; // reportes completo + ordenes con alcance propios
let sinReportes: Sesion; // solo ordenes
let ajeno: Sesion;
let empresaA: string;
let empresaB: string;

const dia = (desplazamiento: number) => new Date(Date.now() + desplazamiento * 86_400_000).toISOString().slice(0, 10);
const PERIODO = () => ({ desde: dia(-30), hasta: dia(30) });
const codigo = (r: RespuestaHttp): string | undefined => r.cuerpo?.error?.codigo;
const datos = (r: RespuestaHttp): any => {
  if (!r.cuerpo?.ok) throw new Error(`Se esperaba éxito y llegó ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const modulosDe = (panel: any): string[] => panel.bloques.map((b: any) => b.modulo);
const indicador = (panel: any, modulo: string, id: string) => panel.bloques.find((b: any) => b.modulo === modulo)?.indicadores.find((i: any) => i.id === id);

/** Da acceso a otro módulo a quien ya es miembro (agregarMiembro solo se llama una vez por persona). */
const asignar = (empresaId: string, s: Sesion, modulo: string, nivel: 'completo' | 'lectura', alcance: 'todos' | 'propios' = 'todos') =>
  comoEmpresa(
    appPool,
    empresaId,
    (c) =>
      c.query(
        `insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel, alcance) values ($1, $2, $3, $4, $5)
         on conflict (tenant_id, usuario_id, modulo) do update set nivel = excluded.nivel, alcance = excluded.alcance`,
        [empresaId, s.usuarioId, modulo, nivel, alcance],
      ),
    { confirmar: true },
  );

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, parcial, lector, propio, sinReportes, ajeno] = await Promise.all(['Dueña', 'Parcial', 'Lectora', 'Propia', 'Sin reportes', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de reportes');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de reportes');
  await Promise.all(MODULOS.flatMap((m) => [activarModulo(empresaA, m), activarModulo(empresaB, m)]));
  await agregarMiembro(app, empresaA, parcial, { modulo: 'reportes', nivel: 'completo', alcance: 'todos' });
  await asignar(empresaA, parcial, 'ordenes', 'completo');
  await agregarMiembro(app, empresaA, lector, { modulo: 'reportes', nivel: 'lectura', alcance: 'todos' });
  await asignar(empresaA, lector, 'ordenes', 'lectura');
  await agregarMiembro(app, empresaA, propio, { modulo: 'reportes', nivel: 'completo', alcance: 'todos' });
  await asignar(empresaA, propio, 'ordenes', 'completo', 'propios');
  await agregarMiembro(app, empresaA, sinReportes, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  // Un pedido confirmado en A para que el panel tenga una cifra que reconocer.
  const cliente = datos(await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol' })).id;
  const pedido = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente, lineas: [{ descripcion: 'Trabajo', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118000 }] }));
  datos(await dueno.herramienta('pedido_confirmar', { id: pedido.id }));
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('reportes_panel', () => {
  it('la dueña ve un bloque por módulo con resumen, con las cifras de su empresa', async () => {
    const panel = datos(await dueno.herramienta('reportes_panel', PERIODO()));
    expect(modulosDe(panel)).toEqual(expect.arrayContaining(['registro', 'ordenes', 'crm', 'insumos', 'personal']));
    expect(modulosDe(panel)).not.toContain('reportes');
    expect(indicador(panel, 'ordenes', 'confirmados')).toMatchObject({ valor: 1, tipo: 'cantidad' });
    expect(indicador(panel, 'ordenes', 'totalConfirmadoCentimos')).toMatchObject({ valor: 11800, tipo: 'dinero' });
    expect(panel.bloques.every((b: any) => b.soloLectura === false)).toBe(true);
  });

  it('un miembro sin acceso a un módulo no ve su bloque', async () => {
    const panel = datos(await parcial.herramienta('reportes_panel', PERIODO()));
    expect(modulosDe(panel)).toEqual(['ordenes']);
  });

  it('con alcance «propios» en un módulo, su bloque no aparece (el resumen es de toda la empresa)', async () => {
    const panel = datos(await propio.herramienta('reportes_panel', PERIODO()));
    expect(modulosDe(panel)).toEqual([]);
  });

  it('sin el módulo reportes asignado: modulo_no_disponible', async () => {
    expect(codigo(await sinReportes.herramienta('reportes_panel', PERIODO()))).toBe('modulo_no_disponible');
  });

  it('otra empresa no ve cifras de ésta', async () => {
    const panel = datos(await ajeno.herramienta('reportes_panel', PERIODO()));
    expect(indicador(panel, 'ordenes', 'confirmados')).toMatchObject({ valor: 0 });
  });

  it('valida el período y los argumentos', async () => {
    expect(codigo(await dueno.herramienta('reportes_panel', { desde: dia(5), hasta: dia(1) }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('reportes_panel', { desde: dia(-400), hasta: dia(0) }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('reportes_panel', { ...PERIODO(), extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('reportes_panel', { ...PERIODO(), empresaId: empresaB }))).toBe('argumento_prohibido');
  });

  it('un módulo en baja se ve, en solo lectura', async () => {
    await darDeBajaModulo(empresaA, 'insumos');
    const panel = datos(await dueno.herramienta('reportes_panel', PERIODO()));
    expect(panel.bloques.find((b: any) => b.modulo === 'insumos')?.soloLectura).toBe(true);
    expect(panel.bloques.find((b: any) => b.modulo === 'ordenes')?.soloLectura).toBe(false);
  });
});

describe('reportes_exportar_csv', () => {
  it('entrega el panel en filas planas, con BOM y encabezado', async () => {
    const r = datos(await dueno.herramienta('reportes_exportar_csv', PERIODO()));
    expect(r.nombreDeArchivo).toMatch(/^indicadores-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(r.contenido.startsWith('﻿Módulo,Indicador,Valor,Unidad\r\n')).toBe(true);
    expect(r.contenido).toContain('Pedidos,Confirmados,1,cantidad');
    expect(r.contenido).toContain('Pedidos,Total confirmado,118.00,soles');
    expect(r.filas).toBe(r.contenido.split('\r\n').filter(Boolean).length - 1);
  });

  it('ninguna celda puede leerse como fórmula', async () => {
    const r = datos(await dueno.herramienta('reportes_exportar_csv', PERIODO()));
    for (const linea of r.contenido.replace('﻿', '').split('\r\n').filter(Boolean)) {
      for (const celda of linea.split(',')) expect(celda.replace(/^"/, '')).not.toMatch(/^[=+@\t\r]/);
    }
  });

  it('sin el permiso de exportar (nivel lectura): sin_permiso; ver sigue funcionando', async () => {
    expect(codigo(await lector.herramienta('reportes_exportar_csv', PERIODO()))).toBe('sin_permiso');
    expect(modulosDe(datos(await lector.herramienta('reportes_panel', PERIODO())))).toEqual(['ordenes']);
  });

  it('exporta solo los módulos accesibles y respeta el aislamiento', async () => {
    const r = datos(await parcial.herramienta('reportes_exportar_csv', PERIODO()));
    expect(r.contenido).toContain('Pedidos,');
    expect(r.contenido).not.toContain('Personal,');
    const b = datos(await ajeno.herramienta('reportes_exportar_csv', PERIODO()));
    expect(b.contenido).toContain('Pedidos,Confirmados,0,cantidad');
  });

  it('sin el módulo reportes: modulo_no_disponible', async () => {
    expect(codigo(await sinReportes.herramienta('reportes_exportar_csv', PERIODO()))).toBe('modulo_no_disponible');
  });
});
