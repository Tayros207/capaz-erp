import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { lastValueFrom, toArray } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { EventoDelAgente, TurnoDelAgente } from '@capaz/shared';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { MODELO_DE_CHAT } from './modelo-de-chat.js';
import { guion, ModeloSimulado } from './modelo-simulado.js';
import { ServicioDeTurnos } from './servicio-de-turnos.js';

// El asistente recuerda los chats anteriores de ESTA persona: solo los suyos, con lo buscado tal cual y sin traer de más.

let app: AppDePruebas;
let appPool: pg.Pool;
let modelo: ModeloSimulado;
let servicio: ServicioDeTurnos;
let dueno: { sesion: Sesion; empresa: string; ctx: ContextoDeHerramienta };
let miembro: ContextoDeHerramienta;

const cuerpo = (mensaje: string): TurnoDelAgente => ({ turnoId: randomUUID(), mensaje, origen: 'texto' });
async function charlar(mensaje: string, respuesta: string): Promise<EventoDelAgente[]> {
  modelo.programar([guion.respuesta(respuesta)]);
  return (await lastValueFrom(servicio.iniciar(dueno.ctx, cuerpo(mensaje)).pipe(toArray()))).map((e) => e.data as EventoDelAgente);
}
async function buscar(ctx: ContextoDeHerramienta, args: Record<string, unknown>) {
  const r = await app.obtener(EjecutorDeHerramientas).ejecutar('conversaciones_buscar', args, { ctx });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return (r as { datos: { coincidencias: { conversacionId: string; titulo: string; fragmentos: { rol: string; texto: string }[] }[] } }).datos.coincidencias;
}

beforeAll(async () => {
  process.env.AGENTE_PROVEEDOR = 'simulado';
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  modelo = app.obtener<ModeloSimulado>(MODELO_DE_CHAT as unknown as symbol);
  servicio = app.obtener(ServicioDeTurnos);
  const sesion = await abrirSesion(app, 'Dueña que recuerda');
  const empresa = await crearEmpresa(sesion, 'Imprenta que recuerda');
  const acceso = app.obtener(ServicioDeAcceso);
  dueno = { sesion, empresa, ctx: (await acceso.contextoDe(empresa, sesion.usuarioId, 'ui', 'prueba'))! };
  const otro = await abrirSesion(app, 'Miembro que no debe ver');
  await agregarMiembro(app, empresa, otro, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
  miembro = (await acceso.contextoDe(empresa, otro.usuarioId, 'ui', 'prueba'))!;
  await charlar('Necesito el pedido del troquel para Juan Pérez', 'Anotado: el troquel de Juan Pérez queda pendiente de precio.');
  await charlar('Revisa los volantes del mes. El descuento es del 100% del flete', 'Los volantes del mes están al día.');
});
afterAll(async () => {
  delete process.env.AGENTE_PROVEEDOR;
  await app.cerrar();
  await appPool.end();
});

describe('conversaciones_buscar', () => {
  it('encuentra lo hablado (lo dicho por la persona y lo respondido) y de qué conversación sale', async () => {
    const r = await buscar(dueno.ctx, { texto: 'troquel' });
    expect(r).toHaveLength(1);
    expect(r[0]!.titulo).toContain('troquel');
    expect(r[0]!.fragmentos.map((f) => f.rol).sort()).toEqual(['agente', 'persona']);
    expect(r[0]!.fragmentos.some((f) => f.texto.includes('Juan Pérez'))).toBe(true);
  });

  it('sin texto devuelve lo más reciente de cada conversación, una línea por chat, lo último primero', async () => {
    const r = await buscar(dueno.ctx, {});
    expect(r).toHaveLength(2);
    expect(r[0]!.titulo).toContain('volantes');
    expect(r.every((c) => c.fragmentos.length === 1)).toBe(true);
  });

  it('lo buscado se toma tal cual: «%» no es un comodín, y «100%» encuentra solo lo que lo dice', async () => {
    expect((await buscar(dueno.ctx, { texto: '100%' }))).toHaveLength(1);
    const soloPorcentaje = await buscar(dueno.ctx, { texto: '%' });
    expect(soloPorcentaje).toHaveLength(1);
    expect(soloPorcentaje[0]!.titulo).toContain('volantes');
    expect(await buscar(dueno.ctx, { texto: '_' })).toEqual([]);
  });

  it('otra persona de la misma empresa no ve nada de estos chats', async () => {
    expect(await buscar(miembro, { texto: 'troquel' })).toEqual([]);
    expect(await buscar(miembro, {})).toEqual([]);
  });

  it('respeta el límite de conversaciones', async () => {
    expect(await buscar(dueno.ctx, { limite: 1 })).toHaveLength(1);
  });

  it('el asistente la puede usar en un turno y recibe lo hablado', async () => {
    modelo.programar([[guion.llamar('c1', 'conversaciones_buscar', { texto: 'troquel' })], guion.respuesta('Hablamos del troquel de Juan.')]);
    await lastValueFrom(servicio.iniciar(dueno.ctx, cuerpo('¿Qué hablamos del troquel?')).pipe(toArray()));
    const resultado = JSON.parse((modelo.peticiones[1]!.mensajes.at(-1) as { content: string }).content);
    expect(resultado.ok).toBe(true);
    expect(resultado.datos.coincidencias[0].titulo).toContain('troquel');
  });
});
