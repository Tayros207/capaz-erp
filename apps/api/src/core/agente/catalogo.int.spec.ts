import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa } from '../herramientas/http-de-pruebas.js';
import { RegistroDeConsumidores } from '../eventos/registro-de-consumidores.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { catalogoDelTurno, PRESUPUESTO_DE_TOKENS, SIEMPRE } from './catalogo-del-turno.js';
import { esquemaParaElModelo } from './esquema-limpio.js';
import { FLUJOS_DEL_ERP } from './guia-del-erp.js';
import { DINERO, DIRECTAS, LECTURAS_EXCLUIDAS, PROHIBIDAS, SIEMPRE_PERSONA } from './politica.js';

// El catálogo y la política del asistente contra el registro REAL de herramientas (las que existen hoy en la aplicación).
// Si alguien renombra o borra una herramienta que una lista nombra, o añade una crítica a la lista de directas, falla aquí.

let app: AppDePruebas;
let ctxDueno: ContextoDeHerramienta;
let registro: RegistroDeHerramientas;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  const dueno = await abrirSesion(app, 'Dueña del catálogo');
  const empresa = await crearEmpresa(dueno, 'Imprenta del catálogo');
  ctxDueno = (await app.obtener(ServicioDeAcceso).contextoDe(empresa, dueno.usuarioId, 'ui', 'catalogo'))!;
  registro = app.obtener(RegistroDeHerramientas);
});
afterAll(async () => {
  await app.cerrar();
});

describe('el catálogo y la política contra el registro real', () => {
  it('las 303 herramientas de negocio convierten su esquema sin error', () => {
    for (const h of registro.todas()) expect(() => esquemaParaElModelo(h.nombre, h.entrada), h.nombre).not.toThrow();
    expect(registro.todas().length).toBeGreaterThanOrEqual(300);
  });

  it('las listas de la política nombran herramientas que existen', () => {
    const nombres = new Set(registro.todas().map((h) => h.nombre));
    const faltan = (lista: ReadonlySet<string>) => [...lista].filter((n) => !nombres.has(n));
    expect(faltan(PROHIBIDAS)).toEqual([]);
    expect(faltan(DIRECTAS)).toEqual([]);
    expect(faltan(LECTURAS_EXCLUIDAS)).toEqual([]);
    expect(faltan(DINERO)).toEqual([]);
    expect(faltan(SIEMPRE_PERSONA)).toEqual([]);
    expect(SIEMPRE.filter((n) => !nombres.has(n))).toEqual([]);
  });

  it('ninguna herramienta «directa» es crítica o mueve dinero, y las lecturas excluidas son lecturas', () => {
    for (const h of registro.todas()) {
      if (DIRECTAS.has(h.nombre)) expect(h.criticidad === 'critica' || h.mueveDinero, h.nombre).toBe(false);
      if (LECTURAS_EXCLUIDAS.has(h.nombre)) expect(h.criticidad, h.nombre).toBe('lectura');
    }
  });

  it('toda herramienta de escritura está clasificada: crítica, o en UNA sola lista (una herramienta nueva obliga a decidir)', () => {
    const listas: [string, ReadonlySet<string>][] = [['PROHIBIDAS', PROHIBIDAS], ['DIRECTAS', DIRECTAS], ['SIEMPRE_PERSONA', SIEMPRE_PERSONA], ['DINERO', DINERO]];
    const sinClasificar: string[] = [];
    const repetidas: string[] = [];
    for (const h of registro.todas()) {
      if (h.criticidad === 'lectura') continue;
      const en = listas.filter(([, l]) => l.has(h.nombre)).map(([n]) => n);
      if (en.length > 1) repetidas.push(`${h.nombre}: ${en.join('+')}`);
      if (en.length === 0 && h.criticidad !== 'critica' && h.nombre !== 'captura_proponer' && !h.nombre.startsWith('agente_')) sinClasificar.push(h.nombre);
    }
    expect(repetidas).toEqual([]);
    expect(sinClasificar).toEqual([]);
  });

  it('la guía del ERP cuadra con los consumidores de eventos reales y con herramientas que existen (no se desactualiza)', () => {
    const consumidores = app.obtener(RegistroDeConsumidores).todos().filter((c) => c.evento !== '*').map((c) => c.nombre);
    const enLaGuia = FLUJOS_DEL_ERP.map((f) => f.consumidor);
    expect(consumidores.filter((n) => !enLaGuia.includes(n)), 'consumidores sin fila en guia-del-erp.ts').toEqual([]);
    expect(enLaGuia.filter((n) => !consumidores.includes(n)), 'filas de la guía cuyo consumidor ya no existe').toEqual([]);
    const herramientas = new Set(registro.todas().map((h) => h.nombre));
    for (const f of FLUJOS_DEL_ERP) for (const t of f.herramientas) expect(herramientas.has(t), `${f.consumidor} → ${t}`).toBe(true);
  });

  it('el dinero y lo que mueve dinero nunca está en las directas', () => {
    for (const h of registro.todas()) {
      if (h.mueveDinero) expect(DIRECTAS.has(h.nombre), h.nombre).toBe(false);
    }
  });

  it('el catálogo de un turno cabe en el presupuesto aunque la pantalla sea la del módulo más grande', () => {
    for (const modulo of [null, 'ordenes', 'registro', 'cotizador', 'core', 'crm']) {
      const r = catalogoDelTurno({ herramientas: registro.todas(), ctx: ctxDueno, pantalla: modulo ? { ruta: '/x', modulo, entidad: null } : null, modo: 'borradores' });
      expect(r.tokens, String(modulo)).toBeLessThanOrEqual(PRESUPUESTO_DE_TOKENS);
      expect(r.tools.slice(-3).map((t) => (t as { function: { name: string } }).function.name)).toEqual(['software_mapa', 'herramienta_describir', 'herramienta_llamar']);
    }
  });

  it('en el modo «ninguna» (ya no se usa, pero se conserva como freno global) el modelo no ve ninguna herramienta que cambie datos, salvo captura_proponer', () => {
    const r = catalogoDelTurno({ herramientas: registro.todas(), ctx: ctxDueno, pantalla: { ruta: '/x', modulo: 'ordenes', entidad: null }, modo: 'ninguna' });
    for (const nombre of r.nombres) {
      const h = registro.obtener(nombre)!;
      expect(h.criticidad === 'lectura' || nombre === 'captura_proponer', nombre).toBe(true);
    }
    expect(r.nombres).toContain('captura_proponer');
  });
});
