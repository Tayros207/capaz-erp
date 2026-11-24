import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import { agenteLecciones } from '../../db/esquema/core-agente.js';
import { limpiarNombre } from './prompt.js';
import { guardarLeccion, type LeccionNueva } from './repositorio-de-memoria.js';
import type { IntentoDeHerramienta } from './tipos-del-turno.js';

// Lo que el asistente aprende SOLO, sin gastar otro modelo y sin copiar nunca datos de la empresa: las lecciones salen de plantillas
// del servidor y de las decisiones de las personas, jamás de texto libre del modelo ni de valores de los resultados.
// 1) Un error de argumentos que el propio asistente corrigió dentro del turno.
// 2) Un borrador del asistente que una persona descartó (con su motivo) o corrigió (qué campos cambió).

const CODIGOS_QUE_ENSEÑAN = new Set(['argumentos_invalidos', 'argumento_prohibido']);
const NOMBRE_DE_CAMPO = /^[a-zA-Z][a-zA-Z0-9]{0,40}$/;
const campos = (claves: readonly string[], validos: ReadonlySet<string>): string[] => claves.filter((k) => NOMBRE_DE_CAMPO.test(k) && validos.has(k)).slice(0, 5);

/** «Falló con argumentos inválidos y se corrigió»: una lección por herramienta y por tipo de corrección. `validos` = los campos que de verdad existen. */
export function leccionesDeErroresCorregidos(
  intentos: readonly IntentoDeHerramienta[],
  titulo: (herramienta: string) => string,
  camposDe: (herramienta: string) => ReadonlySet<string>,
): LeccionNueva[] {
  const salida = new Map<string, LeccionNueva>();
  intentos.forEach((fallo, i) => {
    if (fallo.ok || !fallo.codigo || !CODIGOS_QUE_ENSEÑAN.has(fallo.codigo)) return;
    const acierto = intentos.slice(i + 1).find((x) => x.nombre === fallo.nombre && x.ok);
    if (!acierto) return;
    const validos = camposDe(fallo.nombre);
    const faltaban = campos(acierto.claves.filter((k) => !fallo.claves.includes(k)), validos);
    const sobraban = campos(fallo.claves.filter((k) => !acierto.claves.includes(k)), validos);
    const como = faltaban.length > 0 ? `faltaba indicar ${faltaban.map((k) => `«${k}»`).join(', ')}` : sobraban.length > 0 ? `sobraba ${sobraban.map((k) => `«${k}»`).join(', ')}` : 'había que corregir el valor de un dato';
    const clave = `err:${fallo.nombre}:${faltaban.join('+')}:${sobraban.join('+')}`.slice(0, 160);
    salida.set(clave, {
      tipo: 'error_de_herramienta', clave, herramienta: fallo.nombre, origen: 'sistema', estado: 'vigente',
      texto: limpiarNombre(`Al usar «${titulo(fallo.nombre)}» la primera llamada falló y se corrigió: ${como}. Antes de llamarla, mira «herramienta_describir».`, 280),
    });
  });
  return [...salida.values()];
}

const camposCambiados = (antes: unknown, despues: unknown): string[] => {
  const a = antes !== null && typeof antes === 'object' ? (antes as Record<string, unknown>) : {};
  const d = despues !== null && typeof despues === 'object' ? (despues as Record<string, unknown>) : {};
  return [...new Set([...Object.keys(a), ...Object.keys(d)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]) && NOMBRE_DE_CAMPO.test(k)).sort().slice(0, 5);
};

/**
 * Lecciones de los borradores del asistente que una persona ya resolvió y todavía no se anotaron. Se llama al abrir un turno (es una
 * consulta: no depende de eventos ni del relevo). Una persona que descarta o corrige un borrador es la fuente: nace vigente.
 */
export async function capturarLeccionesDeBorradores(tx: Transaccion, titulo: (herramienta: string) => string): Promise<number> {
  const [{ usuario } = { usuario: '' }] = (await tx.execute<{ usuario: string }>(sql`select current_setting('app.user_id', true) as usuario`)).rows;
  const usuarioActual = usuario;
  const resueltos = await tx
    .select({ id: borradores.id, herramienta: borradores.herramienta, estado: borradores.estado, corregido: borradores.corregido, args: borradores.args, argsOriginales: borradores.argsOriginales, motivo: borradores.motivoDescarte, resueltoPor: borradores.resueltoPor })
    .from(borradores)
    .where(and(eq(borradores.tenantId, sql`current_setting('app.tenant_id', true)`), eq(borradores.origen, 'agente'), eq(borradores.propuestoPor, sql`current_setting('app.user_id', true)`), sql`${borradores.resueltoEn} > now() - interval '30 days'`, sql`(${borradores.estado} = 'descartado' or (${borradores.estado} = 'aprobado' and ${borradores.corregido})) `, sql`not exists (select 1 from core.agente_lecciones l where l.tenant_id = ${borradores.tenantId} and l.clave = 'borrador:' || ${borradores.id}::text)`))
    .orderBy(sql`${borradores.resueltoEn} desc`)
    .limit(20);
  if (resueltos.length === 0) return 0;
  const claves = resueltos.map((b) => `borrador:${b.id}`);
  const hechas = await tx.select({ clave: agenteLecciones.clave }).from(agenteLecciones).where(and(eq(agenteLecciones.tenantId, sql`current_setting('app.tenant_id', true)`), eq(agenteLecciones.usuarioId, sql`current_setting('app.user_id', true)`), inArray(agenteLecciones.clave, claves)));
  const yaEstan = new Set(hechas.map((h) => h.clave));
  let nuevas = 0;
  for (const b of resueltos) {
    const clave = `borrador:${b.id}`;
    if (yaEstan.has(clave)) continue;
    const que = titulo(b.herramienta);
    // El motivo es texto libre: solo cuenta si lo escribió la MISMA persona que propuso (la dueña de esta lección), no otra.
    const motivo = b.motivo && b.resueltoPor === usuarioActual ? limpiarNombre(b.motivo, 120) : '';
    const cambios = camposCambiados(b.argsOriginales, b.args);
    const texto =
      b.estado === 'descartado'
        ? `Una persona descartó mi borrador de «${que}»${motivo ? ` (motivo: «${motivo}»)` : ''}. No lo propongas de nuevo en una situación parecida sin preguntar antes.`
        : `Una persona corrigió mi borrador de «${que}»${cambios.length > 0 ? `: cambió ${cambios.map((k) => `«${k}»`).join(', ')}` : ''}. Revisa esos datos con más cuidado la próxima vez.`;
    const r = await guardarLeccion(tx, { tipo: 'correccion', clave, texto: limpiarNombre(texto, 280), herramienta: b.herramienta, origen: 'persona', estado: 'vigente' });
    if (!('lleno' in r) && r.nueva) nuevas += 1;
  }
  return nuevas;
}
