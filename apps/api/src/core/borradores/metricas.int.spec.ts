import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { interpreteDePrueba } from '../captura/interprete-de-prueba.js';
import { RegistroDeInterpretes } from '../captura/registro-de-interpretes.js';

// borradores_metricas por HTTP real: los cuatro estados de voz, uno de origen `modulo`, un member sin registro y la zona de la empresa.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let sinRegistro: Sesion;
let A: string;
let rango: { desde: string; hasta: string };

const codigoDe = (r: { cuerpo: any }): string | undefined => r.cuerpo?.error?.codigo;
const datos = (r: { estado: number; cuerpo: any }) => {
  if (r.estado !== 200) throw new Error(`Se esperaba 200: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const proponer = async (texto: string) => datos(await dueno.herramienta('captura_proponer', { texto, origen: 'voz', transcurridoMs: 5000 })).borradores[0].id as string;
const dia = (d: Date, zona = 'America/Lima') => new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(d);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  app.obtener(RegistroDeInterpretes).fijar(interpreteDePrueba);
  [dueno, sinRegistro] = await Promise.all(['Dueña', 'Sin registro'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Métricas A');
  await activarModulo(A, 'crm');
  await agregarMiembro(app, A, sinRegistro, { modulo: 'crm', nivel: 'completo', alcance: 'todos' });
  datos(await dueno.herramienta('registro_iniciar', {}));
  const hoy = dia(new Date());
  rango = { desde: hoy, hasta: hoy };

  const sin = await proponer('uno');
  const corr = await proponer('dos');
  const desc = await proponer('tres');
  await proponer('cuatro'); // queda pendiente
  datos(await dueno.herramienta('borrador_aprobar', { id: sin }));
  datos(await dueno.herramienta('borrador_corregir', { id: corr, args: { tipo: 'ingreso', montoCentimos: 70000, origen: 'voz' } }));
  datos(await dueno.herramienta('borrador_aprobar', { id: corr }));
  datos(await dueno.herramienta('borrador_descartar', { id: desc, motivo: 'repetido' }));
  // Uno de origen `modulo`: no debe contar.
  await comoEmpresa(
    appPool,
    A,
    (c) =>
      c.query(
        `insert into core.borradores (tenant_id, herramienta, modulo, args, args_originales, resumen, origen, propuesto_por)
         values ($1, 'movimiento_registrar', 'registro', '{}', '{}', 'de módulo', 'modulo', 'sistema')`,
        [A],
      ),
    { confirmar: true },
  );
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('borradores_metricas', () => {
  it('cuenta los de captura, ignora los de otro origen y mide corrección y tiempo', async () => {
    const m = datos(await dueno.herramienta('borradores_metricas', rango));
    expect(m).toMatchObject({ propuestos: 4, aprobadosSinCorregir: 1, aprobadosCorregidos: 1, descartados: 1, pendientes: 1, pctSinCorregir: 33.3, enLaMismaSesion: 2 });
    expect(m.camposCorregidos).toEqual([{ campo: 'montoCentimos', veces: 1 }]);
    expect(m.medianaSegundos).not.toBeNull();
    expect(datos(await dueno.herramienta('borradores_metricas', { ...rango, origen: 'texto' })).propuestos).toBe(0);
    expect(datos(await dueno.herramienta('borradores_metricas', { ...rango, modulo: 'crm' })).propuestos).toBe(0);
  });

  it('un member sin registro recibe ceros', async () => {
    const m = datos(await sinRegistro.herramienta('borradores_metricas', rango));
    expect(m).toMatchObject({ propuestos: 0, pctSinCorregir: null, medianaSegundos: null, camposCorregidos: [] });
  });

  it('93 días son argumentos_invalidos; el rango invertido también', async () => {
    expect(codigoDe(await dueno.herramienta('borradores_metricas', { desde: '2026-01-01', hasta: '2026-04-04' }))).toBe('argumentos_invalidos');
    expect(datos(await dueno.herramienta('borradores_metricas', { desde: '2026-01-01', hasta: '2026-04-02' })).propuestos).toBe(0);
    expect(codigoDe(await dueno.herramienta('borradores_metricas', { desde: '2026-02-02', hasta: '2026-02-01' }))).toBe('argumentos_invalidos');
  });

  it('el corte de día usa la zona de la empresa', async () => {
    // Se mueve la hora de propuesta a 03:00 UTC de hoy: en Lima (UTC−5) es el día anterior.
    const hoyUtc = new Date().toISOString().slice(0, 10);
    await comoEmpresa(appPool, A, (c) => c.query(`update core.borradores set propuesto_en = $1::timestamptz where origen = 'voz'`, [`${hoyUtc}T03:00:00Z`]), { confirmar: true });
    const lima = dia(new Date(`${hoyUtc}T03:00:00Z`));
    expect(lima < hoyUtc).toBe(true);
    expect(datos(await dueno.herramienta('borradores_metricas', { desde: lima, hasta: lima })).propuestos).toBe(4);
    expect(datos(await dueno.herramienta('borradores_metricas', { desde: hoyUtc, hasta: hoyUtc })).propuestos).toBe(0);
  });
});
