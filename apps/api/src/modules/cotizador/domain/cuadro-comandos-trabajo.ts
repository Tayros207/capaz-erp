// Comandos sobre el trabajo y la imposición. Cada uno recibe el cuadro (una copia), aplica el cambio y devuelve el cuadro
// nuevo con sus avisos; no toca la base. Las filas de papel y planchas las pone al día `sincronizarFilas`, no estos comandos.
import type { ReferenciaDeFila } from '@capaz/shared';
import { CERO, esIgual, esMayor } from './motor/base/dinero.js';
import { columnaDe } from './motor/costeo/tipos/cuadro-directo.js';
import type { Cuadro, Linea, MutacionDeCuadro, ResultadoDeComando } from './cuadro-tipos.js';
import { avisoComercial, rechazarCuadro } from './cuadro-tipos.js';
import { resolverLinea } from './cuadro-filas.js';

type Dimensiones = { anchoCm: string; altoCm: string };

export type DatosDeTrabajo = {
  producto?: string | undefined;
  descripcion?: string | undefined;
  cantidad?: string | undefined;
  pieza?: Dimensiones | undefined;
  tintas?: number | undefined;
  caras?: number | undefined;
};

/** Si cambia la cantidad, las filas por pliego y por unidad no se ajustan solas (el papel y las planchas sí): se avisa. */
function avisoPorCambioDeCantidad(antes: string, cuadro: Cuadro) {
  const cambio = esMayor(antes, CERO) && !esIgual(antes, cuadro.trabajo.cantidad);
  const ligadas = [cuadro.automaticas.papel, cuadro.automaticas.planchas];
  const sinAjustar = cuadro.lineas.filter((l: Linea) => l.escala !== 'fija' && !ligadas.includes(l.id));
  if (!cambio || sinAjustar.length === 0) return [];
  const nombres = sinAjustar.map((l) => `«${l.descripcion}»`).join(', ');
  return [avisoComercial('filas_sin_ajustar', `Cambió la cantidad: revisa las filas que dependen de ella (${nombres}); no se ajustan solas.`)];
}

/**
 * La cantidad del trabajo es la columna base cuando es 100, 1.000 o 5.000 (R2 del PRP-007). Con otra cantidad no hay base y el
 * cuadro se cotiza solo a esa cantidad. Al cambiar de base, la nueva reemplaza a la vieja entre las columnas que se envían.
 */
function cambiarLaBase(cuadro: Cuadro, antes: string): void {
  const directo = cuadro.directo;
  if (!directo) return;
  const nueva = columnaDe(cuadro.trabajo.cantidad);
  if (nueva === null) {
    directo.enviar = [];
    return;
  }
  const vieja = columnaDe(antes);
  directo.enviar = [nueva, ...directo.enviar.filter((c) => c !== vieja && c !== nueva)];
}

export function aplicarTrabajo(cuadro: Cuadro, a: DatosDeTrabajo): ResultadoDeComando {
  const t = cuadro.trabajo;
  const antes = t.cantidad;
  const descripcion = a.descripcion ?? t.descripcion;
  cuadro.trabajo = {
    producto: a.producto ?? t.producto,
    ...(descripcion === undefined ? {} : { descripcion }),
    cantidad: a.cantidad ?? t.cantidad,
    pieza: a.pieza ?? t.pieza,
    tintas: a.tintas ?? t.tintas,
    caras: a.caras ?? t.caras,
    cliente: t.cliente,
  };
  cambiarLaBase(cuadro, antes);
  return { ok: true, cuadro, avisos: avisoPorCambioDeCantidad(antes, cuadro) };
}

export type DatosDeImposicion = {
  /** Lo que copia una máquina del taller (pinza, sangrado, calle, formato máximo y etapas); lo explícito la reemplaza. */
  maquina?: { formatoMaximo: Dimensiones; pinzaCm: string; sangradoCm: string; calleCm: string; etapas: { nombre: string; mermaPct: string; arranque: string }[] } | undefined;
  pliegoMadre?: Dimensiones | undefined;
  pliegoMaquina?: Dimensiones | undefined;
  sangradoCm?: string | undefined;
  calleCm?: string | undefined;
  pinzaCm?: string | undefined;
  formatoMaximo?: Dimensiones | null | undefined;
  etapas?: { nombre: string; mermaPct: string; arranque: string }[] | undefined;
  filaDePapel?: ReferenciaDeFila | null | undefined;
};

/** Liga la fila de papel al motor (su cantidad pasa a ser los pliegos madre) o la suelta (`null`). */
function ligarPapel(cuadro: Cuadro, ref: ReferenciaDeFila | null): MutacionDeCuadro | ReturnType<typeof rechazarCuadro> {
  if (ref === null) {
    cuadro.automaticas.papel = null;
    return { ok: true, cuadro, avisos: [avisoComercial('papel_manual', 'El papel ahora es manual: su cantidad ya no sigue a la imposición.')] };
  }
  const r = resolverLinea(cuadro.lineas, ref);
  if (!r.ok) return r;
  if (r.linea.factor !== 'material') return rechazarCuadro('argumentos_invalidos', `La fila «${r.linea.descripcion}» no es de material: el papel va en el factor Material.`);
  cuadro.automaticas.papel = r.linea.id;
  return { ok: true, cuadro, avisos: [] };
}

export function aplicarImposicion(cuadro: Cuadro, a: DatosDeImposicion): ResultadoDeComando {
  const im = cuadro.imposicion;
  const m = a.maquina;
  cuadro.imposicion = {
    pliegoMadre: a.pliegoMadre ?? im.pliegoMadre,
    pliegoMaquina: a.pliegoMaquina ?? im.pliegoMaquina,
    sangradoCm: a.sangradoCm ?? m?.sangradoCm ?? im.sangradoCm,
    calleCm: a.calleCm ?? m?.calleCm ?? im.calleCm,
    pinzaCm: a.pinzaCm ?? m?.pinzaCm ?? im.pinzaCm,
    formatoMaximo: a.formatoMaximo === undefined ? (m?.formatoMaximo ?? im.formatoMaximo) : a.formatoMaximo,
    etapas: a.etapas ?? m?.etapas ?? im.etapas,
  };
  if (a.filaDePapel === undefined) return { ok: true, cuadro, avisos: [] };
  return ligarPapel(cuadro, a.filaDePapel);
}
