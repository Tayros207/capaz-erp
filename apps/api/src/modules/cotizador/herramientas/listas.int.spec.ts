import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, eventosDe, LISTA_C7 } from './pruebas-de-cotizador.js';

// Módulo `cotizador` (s1) por HTTP real, parte 1: lista de precios, precio_consultar y el camino «módulo no núcleo»
// (permisos, `puedeEscribir`, disparador de escritura). Reglas R2, R3, R14 y R17.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: cotizador en nivel lectura
let sinModulo: Sesion; // member de A sin el módulo cotizador asignado
let ajeno: Sesion; // owner de B
let tercero: Sesion; // owner de C (la empresa a la que se da de baja el módulo)
let A: string;
let B: string;
let C: string;
let volantes: any;

const crear = (s: Sesion, extra: Record<string, unknown> = {}, clave?: string) => s.herramienta('lista_precio_crear', { ...LISTA_C7, ...extra }, { clave });
const filas = (empresaId: string, sql: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query(sql)).rows as any[]);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, ajeno, tercero] = await Promise.all(['Dueña', 'Lector', 'Sin módulo', 'Ajena', 'Tercera'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Cotizador A');
  B = await crearEmpresa(ajeno, 'Cotizador B');
  C = await crearEmpresa(tercero, 'Cotizador C');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador'), activarModulo(C, 'cotizador'), activarModulo(A, 'registro')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, sinModulo, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('primera lista sin haber configurado nada', () => {
  it('la configuración se lee con valores por defecto sin sembrar; crear una lista la deja creada', async () => {
    expect(await datosDe(dueno, 'cotizador_configuracion_ver')).toMatchObject({ utilidadPct: '35.000', igvPorcentaje: 18, redondeoComercial: 'ninguno', actualizadoEn: null });
    expect(await filas(A, 'select 1 from cotizador.configuracion')).toHaveLength(0);

    const r = await crear(dueno);
    expect(r.estado).toBe(200);
    volantes = r.cuerpo.datos;
    expect(volantes).toMatchObject({
      nombre: LISTA_C7.nombre, unidad: 'unidad', productoId: null, p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000,
      modoIntermedio: 'curva', precioMinimoCentimos: null, aConfirmado: false, porRevisar: false, archivadoEn: null,
    });
    expect(await filas(A, 'select 1 from cotizador.configuracion')).toHaveLength(1);
    expect((await datosDe(dueno, 'cotizador_configuracion_ver')).actualizadoEn).not.toBeNull();
    expect(await datosDe(dueno, 'cotizador_iniciar')).toEqual({ configuracionCreada: false });
    expect(await eventosDe(appPool, A)).toEqual([]); // s1 no emite eventos
  });

  it('precio_consultar de 2.500 unidades da 87739 sin IGV, 15793 de IGV y 103532 de total', async () => {
    expect(await datosDe(dueno, 'precio_consultar', { listaId: volantes.id, cantidadMilesimas: 2_500_000 })).toMatchObject({
      listaId: volantes.id, nombre: LISTA_C7.nombre, cantidadMilesimas: 2_500_000, precioListaCentimos: 87_739, importeCentimos: 87_739,
      igvCentimos: 15_793, totalCentimos: 103_532, precioUnitarioMilesimas: 351, minimoAplicado: false, ajusteClientePct: null, redondeoComercial: 'ninguno', igvPorcentaje: 18,
    });
  });

  it('cantidades fuera de 100 a 5.000: conflicto; cantidad cero o campos de más: argumentos_invalidos; ajuste en cero: argumentos_invalidos', async () => {
    const consulta = (args: Record<string, unknown>) => dueno.herramienta('precio_consultar', { listaId: volantes.id, ...args });
    expect(codigoDe(await consulta({ cantidadMilesimas: 99_000 }))).toBe('conflicto');
    expect(codigoDe(await consulta({ cantidadMilesimas: 5_001_000 }))).toBe('conflicto');
    expect(codigoDe(await consulta({ cantidadMilesimas: 0 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await consulta({ cantidadMilesimas: 1_000_000, extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await consulta({ cantidadMilesimas: 1_000_000, ajuste: { tipo: 'monto', importeCentimos: -58_000 } }))).toBe('argumentos_invalidos');
    expect(await datosDe(dueno, 'precio_consultar', { listaId: volantes.id, cantidadMilesimas: 1_000_000, ajuste: { tipo: 'precio', importeCentimos: 50_000 } })).toMatchObject({ precioListaCentimos: 58_000, importeCentimos: 50_000 });
    expect(codigoDe(await dueno.herramienta('precio_consultar', { listaId: randomUUID(), cantidadMilesimas: 1_000_000 }))).toBe('no_encontrado');
  });
});

describe('validación y reglas de una lista', () => {
  it('rechaza precios que no son céntimos enteros positivos, campos de más y producto inexistente', async () => {
    for (const mal of [{ p100Centimos: 0 }, { p100Centimos: 19.5 }, { nombre: '  ' }, { modoIntermedio: 'otro' }, { precioMinimoCentimos: -1 }, { extra: 1 }]) {
      expect(codigoDe(await crear(dueno, { nombre: 'Prueba', ...mal })), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    expect(codigoDe(await crear(dueno, { nombre: 'Prueba', productoId: randomUUID() }))).toBe('no_encontrado');
    expect((await datosDe(dueno, 'listas_precio_listar')).items).toHaveLength(1);
  });

  it('nombre repetido (sin tildes ni mayúsculas): conflicto con la lista como candidata', async () => {
    const r = await crear(dueno, { nombre: 'VOLANTES a5 4/4 couché  150 g' });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.candidatas).toEqual([{ id: volantes.id, nombre: LISTA_C7.nombre, detalle: 'unidad' }]);
  });

  it('invariante B bloquea (19000 / 15000 / 40000); invariante A pide confirmar y se guarda con a_confirmado', async () => {
    const b = await crear(dueno, { nombre: 'Bloqueada', p100Centimos: 19_000, p1000Centimos: 15_000, p5000Centimos: 40_000, confirmarUnitarioNoBaja: true });
    expect(codigoDe(b)).toBe('argumentos_invalidos');
    const a = { nombre: 'Unitario sube', p100Centimos: 19_000, p1000Centimos: 200_000, p5000Centimos: 900_000 };
    const sin = await crear(dueno, a);
    expect(codigoDe(sin)).toBe('conflicto');
    expect(sin.cuerpo.error.mensaje).toMatch(/Confirma para guardarlo igual\.$/);
    expect((await crear(dueno, { ...a, confirmarUnitarioNoBaja: true })).cuerpo.datos).toMatchObject({ aConfirmado: true });
  });

  it('la misma clave de idempotencia no crea dos listas; con otros datos es conflicto', async () => {
    const clave = `lista-${randomUUID()}`;
    const x = await crear(dueno, { nombre: 'Idempotente' }, clave);
    const y = await crear(dueno, { nombre: 'Idempotente' }, clave);
    expect(x.cuerpo.ok).toBe(true);
    expect(y.cuerpo).toEqual(x.cuerpo);
    expect(await filas(A, `select 1 from cotizador.listas_de_precio where nombre = 'Idempotente'`)).toHaveLength(1);
    expect(codigoDe(await crear(dueno, { nombre: 'Idempotente', p100Centimos: 20_000 }, clave))).toBe('conflicto');
  });

  it('un insert directo con precios que no crecen lo rechaza la base (invariante B)', async () => {
    const directo = comoEmpresa(appPool, A, (c) =>
      c.query(
        `insert into cotizador.listas_de_precio (tenant_id, nombre, nombre_normalizado, p100_centimos, p1000_centimos, p5000_centimos, creado_por) values ($1, 'Directa', 'directa', 100, 50, 200, 'u1')`,
        [A],
      ),
    );
    await expect(directo).rejects.toThrow(/lista_invariante_b/);
  });
});

describe('lista_precio_editar es crítica: nada cambia hasta confirmar', () => {
  it('pide confirmación con el resumen, no cambia nada, y la confirmación deja de valer si la lista cambió', async () => {
    const args = { id: volantes.id, p100Centimos: 20_000 };
    const pide = await dueno.herramienta('lista_precio_editar', args);
    expect(pide.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String), resumen: expect.stringContaining('Cambiarás los precios de «Volantes A5 4/4 couché 150 g»: 100 → S/ 200.00 (antes S/ 190.00)') } });
    expect((await datosDe(dueno, 'lista_precio_ver', { id: volantes.id })).p100Centimos).toBe(19_000);
    // Otro cambio entra antes de confirmar: la huella ya no coincide.
    await confirmando(dueno, 'lista_precio_editar', { id: volantes.id, modoIntermedio: 'escalon' });
    const viejo = await dueno.herramienta('lista_precio_editar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(codigoDe(viejo)).toBe('confirmacion_desactualizada');
    expect((await datosDe(dueno, 'lista_precio_ver', { id: volantes.id })).p100Centimos).toBe(19_000);
    const otro = await dueno.herramienta('lista_precio_editar', { ...args, p100Centimos: 21_000 }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(codigoDe(otro)).toBe('confirmacion_no_coincide');
    await confirmando(dueno, 'lista_precio_editar', { id: volantes.id, modoIntermedio: 'curva' });
  });

  it('confirmada, cambia el precio y vuelve a fijar la fecha; renombrar no la toca', async () => {
    await comoEmpresa(appPool, A, (c) => c.query(`update cotizador.listas_de_precio set precios_fijados_en = now() - interval '91 days' where id = $1`, [volantes.id]), { confirmar: true });
    expect((await datosDe(dueno, 'lista_precio_ver', { id: volantes.id })).porRevisar).toBe(true);
    expect((await datosDe(dueno, 'listas_precio_listar', { soloPorRevisar: true })).items.map((x: any) => x.id)).toEqual([volantes.id]);

    const { respuesta, resumen } = await confirmando(dueno, 'lista_precio_editar', { id: volantes.id, nombre: 'Volantes A5 couché' });
    expect(resumen).toBe(`Cambiarás los datos de «${LISTA_C7.nombre}».`);
    expect(respuesta.cuerpo.datos).toMatchObject({ nombre: 'Volantes A5 couché', porRevisar: true });

    const fijado = await confirmando(dueno, 'lista_precio_editar', { id: volantes.id, p100Centimos: 20_000 });
    expect(fijado.respuesta.cuerpo.datos).toMatchObject({ p100Centimos: 20_000, porRevisar: false, aConfirmado: false });
    expect((await datosDe(dueno, 'listas_precio_listar', { soloPorRevisar: true })).items).toEqual([]);
    expect(await datosDe(dueno, 'precio_consultar', { listaId: volantes.id, cantidadMilesimas: 100_000 })).toMatchObject({ importeCentimos: 20_000 });
    expect((await confirmando(dueno, 'lista_precio_editar', { id: volantes.id, p100Centimos: 19_000, nombre: LISTA_C7.nombre })).respuesta.cuerpo.ok).toBe(true);
  });

  it('rechaza lo inválido antes de pedir confirmación: sin cambios, B, A sin confirmar, nombre repetido, id ajeno', async () => {
    const intento = (args: Record<string, unknown>) => dueno.herramienta('lista_precio_editar', { id: volantes.id, ...args });
    expect(codigoDe(await intento({}))).toBe('argumentos_invalidos');
    expect(codigoDe(await intento({ p1000Centimos: 19_000 }))).toBe('argumentos_invalidos');
    const sube = await intento({ p1000Centimos: 200_000, p5000Centimos: 900_000 });
    expect(codigoDe(sube)).toBe('conflicto');
    expect(sube.cuerpo.requiereConfirmacion).toBeUndefined();
    expect(codigoDe(await intento({ nombre: 'Unitario sube' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('lista_precio_editar', { id: randomUUID(), p100Centimos: 1 }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('lista_precio_editar', { id: volantes.id, p100Centimos: 1 }))).toBe('no_encontrado');
    expect((await datosDe(dueno, 'lista_precio_ver', { id: volantes.id })).p1000Centimos).toBe(58_000);
  });
});

describe('archivar, listar y paginar', () => {
  it('archivar oculta la lista, no se edita ni se cotiza, y archivar de nuevo no falla', async () => {
    const extra = (await crear(dueno, { nombre: 'Para archivar' })).cuerpo.datos;
    const archivada = await datosDe(dueno, 'lista_precio_archivar', { id: extra.id });
    expect(archivada.archivadoEn).not.toBeNull();
    expect((await datosDe(dueno, 'lista_precio_archivar', { id: extra.id })).archivadoEn).toBe(archivada.archivadoEn);
    expect(codigoDe(await dueno.herramienta('precio_consultar', { listaId: extra.id, cantidadMilesimas: 1_000_000 }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('lista_precio_editar', { id: extra.id, p100Centimos: 1 }))).toBe('conflicto');
    expect((await datosDe(dueno, 'listas_precio_listar')).items.map((x: any) => x.id)).not.toContain(extra.id);
    expect((await datosDe(dueno, 'listas_precio_listar', { estado: 'archivadas' })).items.map((x: any) => x.id)).toEqual([extra.id]);
    expect((await datosDe(dueno, 'listas_precio_listar', { estado: 'todas' })).items.length).toBeGreaterThan(1);
    // El nombre de una archivada queda libre.
    expect((await crear(dueno, { nombre: 'Para archivar' })).cuerpo.ok).toBe(true);
  });

  it('pagina por nombre con cursor, filtra por texto y rechaza un cursor inválido', async () => {
    const todas = (await datosDe(dueno, 'listas_precio_listar', { limite: 100 })).items.map((x: any) => x.nombre);
    expect(todas).toEqual([...todas].sort((a, b) => a.normalize('NFD').toLowerCase().localeCompare(b.normalize('NFD').toLowerCase())));
    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await datosDe(dueno, 'listas_precio_listar', { limite: 2, cursor });
      expect(p.items.length).toBeLessThanOrEqual(2);
      vistos.push(...p.items.map((x: any) => x.nombre));
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual(todas);
    expect((await datosDe(dueno, 'listas_precio_listar', { buscar: 'COUCHÉ' })).items.map((x: any) => x.nombre)).toEqual([LISTA_C7.nombre]);
    expect((await datosDe(dueno, 'listas_precio_listar', { buscar: '%' })).items).toEqual([]);
    expect(codigoDe(await dueno.herramienta('listas_precio_listar', { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('listas_precio_listar', { limite: 0 }))).toBe('argumentos_invalidos');
  });
});

describe('aislamiento y permisos', () => {
  it('otra empresa no ve nada, ni por id ni en listados', async () => {
    expect((await datosDe(ajeno, 'listas_precio_listar')).items).toEqual([]);
    expect(codigoDe(await ajeno.herramienta('lista_precio_ver', { id: volantes.id }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('precio_consultar', { listaId: volantes.id, cantidadMilesimas: 1_000_000 }))).toBe('no_encontrado');
    expect(codigoDe(await ajeno.herramienta('lista_precio_archivar', { id: volantes.id }))).toBe('no_encontrado');
    expect(await filas(B, 'select 1 from cotizador.listas_de_precio')).toHaveLength(0);
  });

  it('un member de lectura consulta precios pero no escribe; sin el módulo asignado no entra', async () => {
    expect((await datosDe(lector, 'precio_consultar', { listaId: volantes.id, cantidadMilesimas: 2_500_000 })).importeCentimos).toBe(87_739);
    expect((await datosDe(lector, 'listas_precio_listar')).items.length).toBeGreaterThan(0);
    for (const [nombre, args] of [
      ['lista_precio_crear', { ...LISTA_C7, nombre: 'Del lector' }],
      ['lista_precio_editar', { id: volantes.id, p100Centimos: 1 }],
      ['lista_precio_archivar', { id: volantes.id }],
      ['cotizador_configurar', { utilidadPct: '40' }],
      ['cotizador_iniciar', {}],
      ['ajuste_cliente_fijar', { clienteId: randomUUID(), porcentaje: '5' }],
    ] as const) {
      expect(codigoDe(await lector.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    for (const [nombre, args] of [['listas_precio_listar', {}], ['precio_consultar', { listaId: volantes.id, cantidadMilesimas: 1_000_000 }], ['lista_precio_crear', LISTA_C7]] as const) {
      const r = await sinModulo.herramienta(nombre, args);
      expect(r.estado, nombre).toBe(403);
      expect(codigoDe(r), nombre).toBe('modulo_no_disponible');
    }
  });

  it('módulo en baja: se lee, no se escribe por herramienta ni con un insert directo (R3)', async () => {
    const lista = (await crear(tercero)).cuerpo.datos;
    await darDeBajaModulo(C, 'cotizador');
    expect((await datosDe(tercero, 'listas_precio_listar')).items.map((x: any) => x.id)).toEqual([lista.id]);
    expect((await datosDe(tercero, 'precio_consultar', { listaId: lista.id, cantidadMilesimas: 2_500_000 })).importeCentimos).toBe(87_739);
    for (const [nombre, args] of [
      ['lista_precio_crear', { ...LISTA_C7, nombre: 'En baja' }],
      ['lista_precio_editar', { id: lista.id, p100Centimos: 1 }],
      ['lista_precio_archivar', { id: lista.id }],
      ['cotizador_iniciar', {}],
    ] as const) {
      expect(codigoDe(await tercero.herramienta(nombre, args)), nombre).toBe('modulo_solo_lectura');
    }
    const directo = comoEmpresa(appPool, C, (c) =>
      c.query(
        `insert into cotizador.listas_de_precio (tenant_id, nombre, nombre_normalizado, p100_centimos, p1000_centimos, p5000_centimos, creado_por) values ($1, 'Directa', 'directa', 100, 200, 300, 'u1')`,
        [C],
      ),
    );
    await expect(directo).rejects.toThrow(/no está activo/);
    expect(await filas(C, 'select 1 from cotizador.listas_de_precio')).toHaveLength(1);
  });
});
