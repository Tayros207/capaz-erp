// REGLA NUEVA (A2): fusiona el pedido leído por las reglas con el que entendió el modelo. Puro: solo dictado/.
// El modelo separa mejor el cliente y la descripción de cada trabajo; las cantidades, los precios, el adelanto y la entrega que
// leyeron las reglas mandan (elegir.ts). Si las reglas no encontraron trabajos, se usan los del modelo.
import { elegirCentimos, elegirDia, milesimasEnElTexto, nombreDelModelo, vacioANulo, type AvisoDelModelo } from './elegir.js';
import type { ExtraccionDelModelo, LineaDelModelo } from './esquema-del-modelo.js';
import { fechaDeEntregaDicha } from './fecha-dicha.js';
import { PISTA_DE_PEDIDO, type Dictado } from './interpretar-dictado.js';
import type { LineaDictada, PedidoDictado, UnidadDictada } from './reglas/pedido.js';

type Entrada = { texto: string; hoy: string };

const PEDIDO_VACIO: PedidoDictado = { clienteNombre: null, lineas: [], adelantoCentimos: null, entregaEl: null };

/** «500 unidades», «1.5 millares»: solo para el aviso; enteros, sin decimales de coma flotante. */
function cantidadComoTexto(milesimas: number, unidad: UnidadDictada): string {
  const resto = milesimas % 1000;
  const numero = `${Math.trunc(milesimas / 1000)}${resto ? `.${String(resto).padStart(3, '0').replace(/0+$/, '')}` : ''}`;
  const plural = milesimas === 1000 ? '' : unidad === 'docena' ? 's' : 'es';
  return `${numero} ${unidad}${plural}`;
}

function lineaDelModelo(l: LineaDelModelo, texto: string, avisos: AvisoDelModelo[]): LineaDictada {
  const descripcion = l.descripcion.trim();
  const precio = l.precioUnitarioMilesimas;
  if (precio !== null && !milesimasEnElTexto(precio, texto)) {
    avisos.push({ motivo: 'no_aparece', campo: `el precio de «${descripcion}»`, modelo: { tipo: 'milesimas', valor: precio } });
  }
  return { descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: precio, forma: 'unitario', duda: precio === null ? 'sin_precio' : null };
}

/** Misma línea leída por los dos: la descripción del modelo; la cantidad y el precio de las reglas (el modelo solo completa el precio). */
function emparejar(r: LineaDictada, m: LineaDelModelo, texto: string, avisos: AvisoDelModelo[]): LineaDictada {
  const descripcion = vacioANulo(m.descripcion) ?? r.descripcion;
  if (r.unidad !== m.unidad || r.cantidadMilesimas !== m.cantidadMilesimas) {
    const reglas = { tipo: 'texto', valor: cantidadComoTexto(r.cantidadMilesimas, r.unidad) } as const;
    avisos.push({ motivo: 'distinto', campo: `la cantidad de «${descripcion}»`, reglas, modelo: { tipo: 'texto', valor: cantidadComoTexto(m.cantidadMilesimas, m.unidad) } });
    return { ...r, descripcion };
  }
  let precio = r.precioUnitarioMilesimas;
  const delModelo = m.precioUnitarioMilesimas;
  if (precio === null && delModelo !== null) {
    precio = delModelo;
    if (!milesimasEnElTexto(delModelo, texto)) avisos.push({ motivo: 'no_aparece', campo: `el precio de «${descripcion}»`, modelo: { tipo: 'milesimas', valor: delModelo } });
  } else if (precio !== null && delModelo !== null && precio !== delModelo) {
    avisos.push({ motivo: 'distinto', campo: `el precio de «${descripcion}»`, reglas: { tipo: 'milesimas', valor: precio }, modelo: { tipo: 'milesimas', valor: delModelo } });
  }
  const duda = precio === null ? 'sin_precio' : r.duda === 'sin_precio' ? null : r.duda;
  return { ...r, descripcion, precioUnitarioMilesimas: precio, duda };
}

/** Suma exacta de cantidad × precio (BigInt). null si falta algún precio. */
function total(lineas: ReadonlyArray<{ cantidadMilesimas: number; precioUnitarioMilesimas: number | null }>): bigint | null {
  let suma = 0n;
  for (const l of lineas) {
    if (l.precioUnitarioMilesimas === null) return null;
    suma += BigInt(l.cantidadMilesimas) * BigInt(l.precioUnitarioMilesimas);
  }
  return suma;
}

export function fusionarLineas(reglas: readonly LineaDictada[], modelo: readonly LineaDelModelo[], texto: string, avisos: AvisoDelModelo[]): LineaDictada[] {
  const utiles = modelo.filter((l) => vacioANulo(l.descripcion) !== null);
  if (utiles.length === 0) return [...reglas];
  if (reglas.length === 0) return utiles.map((l) => lineaDelModelo(l, texto, avisos));
  if (reglas.length === utiles.length) return reglas.map((r, i) => emparejar(r, utiles[i]!, texto, avisos));
  // Distinto número de trabajos: el modelo solo gana si su lectura da EXACTAMENTE el mismo dinero.
  const deReglas = total(reglas);
  if (deReglas !== null && deReglas === total(utiles)) return utiles.map((l) => lineaDelModelo(l, texto, avisos));
  avisos.push({ motivo: 'distinto', campo: 'los trabajos', reglas: { tipo: 'texto', valor: `${reglas.length} líneas` }, modelo: { tipo: 'texto', valor: `${utiles.length} líneas` } });
  return [...reglas];
}

/** El dictado de pedido ya fusionado. `r` puede ser el de las reglas (pedido) o uno incompleto que el modelo entendió como pedido. */
export function fusionarPedido(r: Dictado, m: ExtraccionDelModelo, e: Entrada, avisos: AvisoDelModelo[]): Dictado {
  const p = r.pedido ?? PEDIDO_VACIO;
  const clienteNombre = nombreDelModelo(m.contactoNombre, e.texto) ?? p.clienteNombre;
  const adelantoCentimos = elegirCentimos('el adelanto', p.adelantoCentimos, m.adelantoCentimos, e.texto, avisos);
  const entregaEl = elegirDia('la entrega', p.entregaEl, m.entregaDicha, (x) => fechaDeEntregaDicha(x, e.hoy), avisos);
  const lineas = fusionarLineas(p.lineas, m.lineas, e.texto, avisos);
  const sinLineas = lineas.length === 0;
  return {
    intencion: 'pedido',
    tipo: null,
    montoCentimos: null,
    adelantoCentimos,
    contactoNombre: clienteNombre,
    descripcion: null,
    categoriaDeRubro: null,
    categoriaDeCapaz: null,
    tipoDeDeuda: null,
    fecha: null,
    pedido: { clienteNombre, lineas, adelantoCentimos, entregaEl },
    faltan: sinLineas ? ['qué se pidió y su precio'] : [],
    pista: sinLineas ? PISTA_DE_PEDIDO : null,
  };
}
