import {
  exito,
  salidaDePendientesSchema,
  type Borrador,
  type EntradaDe,
  type MiDiaDto,
  type Respuesta,
} from '@capaz/shared';
import { diaLocal } from '../automatizaciones/condiciones.js';
import { hoyDeLaEmpresa } from '../empresas/hoy.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import type { RegistroDeHerramientas } from '../herramientas/registro.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { componerMiDia, type FuenteLeida } from './mi-dia-logica.js';

// «Mi día»: el núcleo no lee tablas de pedidos, deudas ni cotizaciones. Descubre las herramientas `<modulo>_pendientes` de
// los módulos a los que la persona puede entrar (igual que el panel de reportes), las llama con `ejecutarDentro` y su
// contexto —mismo permiso, alcance y auditoría que si las pidiera a mano— y suma los borradores por aprobar. Cada lectura
// deja una fila de auditoría: son pocas (una por módulo y una de borradores). Nunca ejecuta nada que cambie datos.

const SUFIJO = '_pendientes';
type Fuentes = MiDiaDto['fuentesConsultadas'];

type Descubierta = { nombre: string; modulo: string; permiso: string | null };

/** Las `_pendientes` registradas, descubiertas por nombre: nada se importa de `modules/*`. */
export function pendientesRegistradas(registro: RegistroDeHerramientas): Descubierta[] {
  return registro
    .todas()
    .filter((h) => h.nombre === `${h.modulo}${SUFIJO}` && h.modulo !== 'core')
    .map((h) => ({ nombre: h.nombre, modulo: h.modulo, permiso: h.permiso }))
    .sort((a, b) => a.modulo.localeCompare(b.modulo));
}

/** ¿Puede ejecutar la herramienta desde la pantalla? Módulo con escritura y permiso; el servidor lo vuelve a validar al llamarla. */
export function puedeEjecutarDesdeMiDia(registro: RegistroDeHerramientas, ctx: ContextoDeHerramienta): (herramienta: string) => boolean {
  return (nombre) => {
    const h = registro.todas().find((x) => x.nombre === nombre);
    if (!h) return false;
    const acceso = ctx.modulos.find((m) => m.codigo === h.modulo);
    if (h.modulo !== 'core' && (!acceso?.puedeEntrar || (h.criticidad !== 'lectura' && !acceso.puedeEscribir))) return false;
    return h.permiso === null || ctx.permisos.includes(h.permiso);
  };
}

async function leerBorradores(ejecutor: EjecutorDeHerramientas, registro: RegistroDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, fuentes: Fuentes): Promise<Borrador[]> {
  if (!ctx.permisos.includes('borradores:ver')) {
    fuentes.push({ modulo: 'borradores', incluida: false, aviso: 'sin acceso' });
    return [];
  }
  const r = await ejecutor.ejecutarDentro(tx, 'borradores_listar', { estado: 'pendiente', limite: 50 }, { ctx });
  if (!r.ok || !('datos' in r)) {
    fuentes.push({ modulo: 'borradores', incluida: false, aviso: 'no se pudo consultar' });
    return [];
  }
  fuentes.push({ modulo: 'borradores', incluida: true, aviso: null });
  const items = (r.datos as { items: Borrador[] }).items;
  // Quien no tiene el permiso de la herramienta propuesta tampoco la ve (misma regla que la bandeja).
  const permiso = (h: string) => registro.todas().find((x) => x.nombre === h)?.permiso ?? null;
  return items.filter((b) => {
    const p = permiso(b.herramienta);
    return p === null || ctx.permisos.includes(p);
  });
}

export async function consultarMiDia(
  ejecutor: EjecutorDeHerramientas,
  registro: RegistroDeHerramientas,
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  args: EntradaDe<'mi_dia_ver'>,
): Promise<Respuesta<MiDiaDto>> {
  const hoy = await hoyDeLaEmpresa(tx);
  const fecha = args.fecha ?? hoy.dia;
  const fuentes: Fuentes = [];
  const leidas: FuenteLeida[] = [];
  for (const d of pendientesRegistradas(registro)) {
    const acceso = ctx.modulos.find((m) => m.codigo === d.modulo);
    if (!acceso) continue; // módulo que la empresa no tiene contratado: no es «sin acceso», simplemente no existe para ella
    if (!acceso.puedeEntrar || (d.permiso !== null && !ctx.permisos.includes(d.permiso))) {
      fuentes.push({ modulo: d.modulo, incluida: false, aviso: 'sin acceso' });
      continue;
    }
    const r = await ejecutor.ejecutarDentro(tx, d.nombre, { fecha }, { ctx });
    const salida = r.ok && 'datos' in r ? salidaDePendientesSchema.safeParse(r.datos) : null;
    if (!salida?.success) {
      // Con alcance «propios» o una caída puntual, ese módulo simplemente no aporta; el aviso lo dice.
      fuentes.push({ modulo: d.modulo, incluida: false, aviso: salida ? 'respuesta no válida' : 'no se pudo consultar' });
      continue;
    }
    // Si el módulo tenía más de lo que cabe, se dice: el resumen solo cuenta lo que se muestra.
    const { total, tarjetas } = salida.data;
    const recorte = total > tarjetas.length ? `se muestran ${tarjetas.length} de ${total.toLocaleString('es-PE')}` : null;
    fuentes.push({ modulo: d.modulo, incluida: true, aviso: recorte });
    leidas.push({ modulo: d.modulo, soloLectura: !acceso.puedeEscribir, tarjetas: salida.data.tarjetas, anotaciones: salida.data.anotaciones });
  }
  const borradores = await leerBorradores(ejecutor, registro, tx, ctx, fuentes);
  const diaDe = (instante: string) => diaLocal(new Date(instante), hoy.zona);
  return exito({ ...componerMiDia({ fecha, fuentes: leidas, borradores, puedeEjecutar: puedeEjecutarDesdeMiDia(registro, ctx), diaDe }), fuentesConsultadas: fuentes });
}
