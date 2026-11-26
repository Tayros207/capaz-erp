import type { AccesoDeModulo, ModoDeEscritura } from '@capaz/shared';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import type { ContextoDeHerramienta, HerramientaRegistrada } from '../herramientas/tipos.js';
import { catalogoDelTurno, PRESUPUESTO_DE_TOKENS, puedeUsar, SIEMPRE } from './catalogo-del-turno.js';
import { esquemaLimpio, esquemaParaElModelo, tokensEstimados } from './esquema-limpio.js';
import { DEFINICIONES_DE_META } from './meta-herramientas.js';

const acceso = (codigo: string, o: Partial<AccesoDeModulo> = {}): AccesoDeModulo => ({ codigo, motivo: 'activo', visible: true, puedeEntrar: true, puedeEscribir: true, nivel: 'completo', alcance: 'todos', diasDePrueba: null, ...o });
const ctx = (o: Partial<ContextoDeHerramienta> = {}): ContextoDeHerramienta => ({
  requestId: 'r', empresaId: 'e', usuarioId: 'u', rol: 'member', permisos: ['x:ver', 'x:editar'],
  modulos: [acceso('core'), acceso('ordenes'), acceso('registro')], canal: 'agente', ...o,
});
function herr(nombre: string, o: Partial<Pick<HerramientaRegistrada, 'modulo' | 'criticidad' | 'permiso' | 'mueveDinero'>> & { campos?: z.ZodRawShape } = {}): HerramientaRegistrada {
  return {
    nombre, modulo: o.modulo ?? 'ordenes', permiso: o.permiso ?? null, criticidad: o.criticidad ?? 'lectura', idempotente: false, mueveDinero: o.mueveDinero ?? false,
    ayuda: { titulo: nombre, paraQueSirve: `Sirve para ${nombre}`, cuandoUsarla: '', campos: [], ejemploTecleado: '', ejemploHablado: '', erroresComunes: ['x'], relacionadas: [] },
    entrada: z.strictObject(o.campos ?? { id: z.uuid().optional() }), salida: z.unknown(), resumir: null, auditar: null, ejecutar: async () => ({ ok: true, datos: {}, avisos: [] }),
  };
}
const nombresDe = (r: { nombres: string[] }) => r.nombres;
const catalogo = (herramientas: HerramientaRegistrada[], o: { c?: ContextoDeHerramienta; modulo?: string | null; modo?: ModoDeEscritura } = {}) =>
  catalogoDelTurno({ herramientas, ctx: o.c ?? ctx(), pantalla: o.modulo ? { ruta: '/m/x', modulo: o.modulo, entidad: null } : null, modo: o.modo ?? 'borradores' });
const nombresDeTools = (r: { tools: unknown[] }) => r.tools.map((t) => (t as { function: { name: string } }).function.name);

describe('puedeUsar', () => {
  it('exige poder entrar al módulo', () => {
    expect(puedeUsar(herr('a', { modulo: 'crm' }), ctx())).toBe(false);
    expect(puedeUsar(herr('a', { modulo: 'ordenes' }), ctx({ modulos: [acceso('ordenes', { puedeEntrar: false })] }))).toBe(false);
  });
  it('una herramienta que cambia algo exige poder escribir en el módulo, salvo en el núcleo', () => {
    const solo = ctx({ modulos: [acceso('ordenes', { puedeEscribir: false }), acceso('core', { puedeEscribir: false })] });
    expect(puedeUsar(herr('a', { criticidad: 'normal' }), solo)).toBe(false);
    expect(puedeUsar(herr('a', { criticidad: 'lectura' }), solo)).toBe(true);
    expect(puedeUsar(herr('a', { criticidad: 'normal', modulo: 'core' }), solo)).toBe(true);
  });
  it('exige el permiso, si lo hay', () => {
    expect(puedeUsar(herr('a', { permiso: 'x:ver' }), ctx())).toBe(true);
    expect(puedeUsar(herr('a', { permiso: 'y:ver' }), ctx())).toBe(false);
  });
});

describe('catalogoDelTurno', () => {
  it('siempre trae las tres meta-herramientas, al final', () => {
    const r = catalogo([herr('mi_dia_ver', { modulo: 'core' })]);
    expect(nombresDeTools(r).slice(-3)).toEqual(['software_mapa', 'herramienta_describir', 'herramienta_llamar']);
    expect(r.tools.slice(-3)).toEqual(DEFINICIONES_DE_META.slice(-3));
  });

  it('lo que la persona no puede usar, el modelo ni lo ve', () => {
    const r = catalogo([herr('clientes_buscar', { modulo: 'core' }), herr('oportunidades_listar', { modulo: 'crm' }), herr('secreta', { modulo: 'core', permiso: 'z:z' })], { modulo: 'crm' });
    expect(nombresDe(r)).toEqual(['clientes_buscar']);
  });

  it('lo prohibido por la política no se ofrece', () => {
    const r = catalogo([herr('clientes_buscar', { modulo: 'core' }), herr('miembro_quitar', { modulo: 'core', criticidad: 'critica' }), herr('exportar_csv', { modulo: 'core' })], { modulo: null });
    expect(nombresDe(r)).toEqual(['clientes_buscar']);
  });

  it('con escritura «ninguna» solo hay lecturas y captura_proponer', () => {
    const h = [herr('pedido_editar', { criticidad: 'normal' }), herr('pedidos_listar'), herr('captura_proponer', { modulo: 'core', criticidad: 'normal' })];
    const r = catalogo(h, { modulo: 'ordenes', modo: 'ninguna' });
    expect(nombresDe(r).sort()).toEqual(['captura_proponer', 'pedidos_listar']);
  });

  it('con escritura por borradores también se ofrecen las que cambian cosas (llegarán como borrador)', () => {
    expect(nombresDe(catalogo([herr('pedido_editar', { criticidad: 'normal' })], { modulo: 'ordenes', modo: 'borradores' }))).toEqual(['pedido_editar']);
  });

  it('trae lo de siempre sin importar la pantalla', () => {
    const todas = SIEMPRE.map((n) => herr(n, { modulo: 'core' }));
    expect(nombresDe(catalogo(todas, { modulo: null })).sort()).toEqual([...SIEMPRE].sort());
  });

  it('suma lo de la pantalla, las lecturas antes que las escrituras, cada grupo en orden alfabético', () => {
    const r = catalogo([herr('z_ver'), herr('a_editar', { criticidad: 'normal' }), herr('b_listar'), herr('m_crear', { criticidad: 'normal' }), herr('clientes_buscar', { modulo: 'core' })], { modulo: 'ordenes' });
    expect(nombresDe(r)).toEqual(['clientes_buscar', 'b_listar', 'z_ver', 'a_editar', 'm_crear']);
  });

  it('un módulo que no es el de la pantalla no entra', () => {
    expect(nombresDe(catalogo([herr('guias_listar'), herr('movimientos_listar', { modulo: 'registro' })], { modulo: 'registro' }))).toEqual(['movimientos_listar']);
  });

  it('el orden es estable entre dos llamadas, aunque el registro llegue en otro orden', () => {
    const h = [herr('b'), herr('a'), herr('c')];
    const uno = catalogo(h, { modulo: 'ordenes' });
    const dos = catalogo([...h].reverse(), { modulo: 'ordenes' });
    expect(JSON.stringify(uno.tools)).toBe(JSON.stringify(dos.tools));
  });

  it('respeta el presupuesto: una pantalla con cientos de herramientas no lo pasa', () => {
    const muchas = Array.from({ length: 400 }, (_, i) => herr(`herramienta_numero_${String(i).padStart(3, '0')}`, { campos: { id: z.uuid(), texto: z.string().max(200), cantidad: z.number().int().optional() } }));
    const r = catalogo(muchas, { modulo: 'ordenes' });
    expect(r.tokens).toBeLessThanOrEqual(PRESUPUESTO_DE_TOKENS);
    expect(tokensEstimados(r.tools)).toBeLessThanOrEqual(PRESUPUESTO_DE_TOKENS);
    expect(r.nombres.length).toBeGreaterThan(0);
    expect(r.nombres.length).toBeLessThan(400);
  });

  it('sin ninguna herramienta accesible solo quedan las meta-herramientas', () => {
    const r = catalogo([], { modulo: 'ordenes' });
    expect(nombresDeTools(r)).toEqual(['software_mapa', 'herramienta_describir', 'herramienta_llamar']);
  });

  it('cada herramienta se describe con «para qué sirve» y su esquema', () => {
    const r = catalogo([herr('pedidos_listar')], { modulo: 'ordenes' });
    expect(r.tools[0]).toMatchObject({ type: 'function', function: { name: 'pedidos_listar', description: 'Sirve para pedidos_listar', parameters: { type: 'object' } } });
  });
});

describe('esquemaLimpio', () => {
  it('quita el pattern cuando hay format y no deja $schema', () => {
    const e = esquemaLimpio(z.strictObject({ id: z.uuid(), dia: z.iso.date() })) as { $schema?: unknown; properties: Record<string, Record<string, unknown>> };
    expect(e.$schema).toBeUndefined();
    expect(e.properties.id).toMatchObject({ type: 'string', format: 'uuid' });
    expect(e.properties.id).not.toHaveProperty('pattern');
    expect(e.properties.dia).not.toHaveProperty('pattern');
  });

  it('quita los límites de entero seguro', () => {
    const e = esquemaLimpio(z.strictObject({ n: z.number().int() })) as { properties: { n: Record<string, unknown> } };
    expect(e.properties.n).not.toHaveProperty('maximum');
    expect(e.properties.n).not.toHaveProperty('minimum');
  });

  it('un campo con valor por defecto sale opcional', () => {
    const e = esquemaLimpio(z.strictObject({ limite: z.number().int().default(20), id: z.string() })) as { required?: string[] };
    expect(e.required).toEqual(['id']);
  });

  it('es un JSON puro: se puede serializar y volver a leer sin perder nada', () => {
    const e = esquemaLimpio(z.strictObject({ a: z.string().refine((v) => v.length > 0) }));
    expect(JSON.parse(JSON.stringify(e))).toEqual(e);
  });
});

describe('esquemaParaElModelo · origen', () => {
  const entrada = z.strictObject({ monto: z.number().int(), origen: z.enum(['teclado', 'voz', 'agente']).default('teclado') });
  it('en las tres herramientas donde lo fija el servidor, el modelo no ve «origen»', () => {
    for (const n of ['movimiento_registrar', 'deuda_abonar', 'deuda_crear_con_adelanto']) {
      const e = esquemaParaElModelo(n, entrada) as { properties: Record<string, unknown>; required?: string[] };
      expect(e.properties).not.toHaveProperty('origen');
      expect(e.properties).toHaveProperty('monto');
      expect(e.required ?? []).not.toContain('origen');
    }
  });
  it('en captura_proponer el modelo tampoco ve el origen ni el tiempo medido, pero sí el texto', () => {
    const dictado = z.strictObject({ texto: z.string(), origen: z.enum(['voz', 'texto']), transcurridoMs: z.number().int() });
    const e = esquemaParaElModelo('captura_proponer', dictado) as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(e.properties)).toEqual(['texto']);
    expect(e.required).toEqual(['texto']);
  });
  it('en cualquier otra herramienta lo deja', () => {
    expect((esquemaParaElModelo('otra', entrada) as { properties: Record<string, unknown> }).properties).toHaveProperty('origen');
  });
});
