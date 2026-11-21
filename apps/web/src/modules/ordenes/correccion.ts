import { ponerIgv, precioConIgvEncima, precioSinIgvIncluido, type EntradaDe, type MotivoDeCorreccion, type PedidoCompletoDto } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { fichaNormalizada, mismaFicha, textoDeFicha, type FichaParcial } from '@capaz/shared';
import { cambiarPrecio } from './logica-filas.ts';
import { formularioDesde, sinFilasEnBlanco, totalesDe, validarPedido, type ErroresDePedido, type LineaDeFormulario } from './logica.ts';

// Lógica pura de «Corregir pedido» (versión 2): atajos de IGV, total fijo, armado de argumentos y vista previa («Qué cambia»).
// Los precios de un pedido INCLUYEN IGV (D17): marcar una línea afecta o no afecta solo cambia el desglose.

export type FormularioDeCorreccion = {
  lineas: LineaDeFormulario[];
  motivo: MotivoDeCorreccion | null;
  motivoTexto: string;
  /** «Fijar total en S/ …»: el servidor reparte la diferencia entre los precios. */
  fijarTotalCentimos: number | null;
};

export const MAXIMO_DE_MOTIVO_TEXTO = 300;

export const formularioDeCorreccion = (p: PedidoCompletoDto): FormularioDeCorreccion => ({ lineas: formularioDesde(p).lineas, motivo: null, motivoTexto: '', fijarTotalCentimos: null });

// --- Atajos de un toque ---

const sobreAfectas = (lineas: readonly LineaDeFormulario[], fn: (precio: number) => number): LineaDeFormulario[] =>
  lineas.map((l) => (l.afectoIgv && l.precioUnitarioMilesimas !== null ? cambiarPrecio(l, fn(l.precioUnitarioMilesimas)) : l));

/** «Faltó sumar el IGV»: el precio tecleado era sin IGV; el nuevo lo incluye. Solo las líneas afectas. */
export const conIgvEncima = (lineas: readonly LineaDeFormulario[], igvPorcentaje: number): LineaDeFormulario[] => sobreAfectas(lineas, (p) => precioConIgvEncima(p, igvPorcentaje));

/** «Se cobró IGV de más»: el precio ya incluía un IGV que no debía; el nuevo es el precio sin IGV. Solo las líneas afectas. */
export const sinIgvIncluido = (lineas: readonly LineaDeFormulario[], igvPorcentaje: number): LineaDeFormulario[] => sobreAfectas(lineas, (p) => precioSinIgvIncluido(p, igvPorcentaje));

/**
 * El precio unitario se guarda con tres decimales (S/ 0.001). Con cantidades grandes y precios chicos (1000 × S/ 0.085), sumar o
 * quitar el IGV al precio no da el 18 % exacto del total: 1000 × S/ 0.100 = S/ 100.00 y no S/ 100.30. Devuelve el total exacto y
 * el que dan los precios, solo si difieren, para avisarlo antes de guardar. `null` si coinciden o no se puede calcular.
 */
export function diferenciaDelAtajo(antes: readonly LineaDeFormulario[], despues: readonly LineaDeFormulario[], igvPorcentaje: number, sentido: 'encima' | 'quitar'): { exactoCentimos: number; conPreciosCentimos: number } | null {
  const total = (lineas: readonly LineaDeFormulario[]) => totalesDe(sinFilasEnBlanco(lineas), igvPorcentaje)?.totalCentimos ?? null;
  const afectas = total(antes.filter((l) => l.afectoIgv));
  const otras = total(antes.filter((l) => !l.afectoIgv));
  const conPrecios = total(despues);
  if (afectas === null || otras === null || conPrecios === null) return null;
  const exacto = (sentido === 'encima' ? ponerIgv(afectas, igvPorcentaje) : precioSinIgvIncluido(afectas, igvPorcentaje)) + otras;
  return exacto === conPrecios ? null : { exactoCentimos: exacto, conPreciosCentimos: conPrecios };
}

/** «Solo cambia el desglose del IGV»: si todas son afectas pasan a no afectas; si no, todas a afectas. El total no cambia. */
export function alternarDesglose(lineas: readonly LineaDeFormulario[]): LineaDeFormulario[] {
  const todasAfectas = lineas.length > 0 && lineas.every((l) => l.afectoIgv);
  return lineas.map((l) => ({ ...l, afectoIgv: !todasAfectas }));
}

/** El motivo que sugiere cada atajo (la persona puede cambiarlo). */
export const MOTIVO_DE_ATAJO: MotivoDeCorreccion = 'igv';

// --- Cambios, validación y argumentos ---

const mismaLinea = (l: LineaDeFormulario, d: PedidoCompletoDto['detalle'][number]): boolean =>
  l.clave === d.id && (l.producto?.id ?? null) === d.productoId && l.descripcion.trim() === d.descripcion && l.unidad === d.unidad &&
  l.cantidadMilesimas === d.cantidadMilesimas && l.precioUnitarioMilesimas === d.precioUnitarioMilesimas && l.afectoIgv === d.afectoIgv && mismaFicha(l, d);

/** Las líneas del formulario difieren de las del pedido (otra cantidad, precio, IGV, fila nueva o quitada). */
export function lineasCambiaron(p: PedidoCompletoDto, f: FormularioDeCorreccion): boolean {
  const lineas = sinFilasEnBlanco(f.lineas);
  return lineas.length !== p.detalle.length || lineas.some((l, i) => !mismaLinea(l, p.detalle[i]!));
}

export const totalDeLaCorreccion = (p: PedidoCompletoDto, f: FormularioDeCorreccion): number | null =>
  f.fijarTotalCentimos ?? totalesDe(sinFilasEnBlanco(f.lineas), p.igvPorcentaje)?.totalCentimos ?? null;

export function hayCambios(p: PedidoCompletoDto, f: FormularioDeCorreccion): boolean {
  return lineasCambiaron(p, f) || (f.fijarTotalCentimos !== null && f.fijarTotalCentimos !== p.totalCentimos);
}

export type ErroresDeCorreccion = ErroresDePedido & Partial<Record<'motivo' | 'motivoTexto' | 'cambios' | 'total', string>>;

export function validarCorreccion(p: PedidoCompletoDto, f: FormularioDeCorreccion): ErroresDeCorreccion {
  const base = validarPedido({ cliente: { id: p.clienteId, nombre: p.clienteNombre }, entregaEl: '', responsableId: '', notas: '', lineas: f.lineas }, p.fecha);
  const e: ErroresDeCorreccion = { ...(base.lineas && { lineas: base.lineas }), ...(base.porLinea && { porLinea: base.porLinea }) };
  if (!f.motivo) e.motivo = 'Elige por qué se corrige.';
  else if (f.motivo === 'otro' && !f.motivoTexto.trim()) e.motivoTexto = 'Con «Otro», escribe qué pasó.';
  if (f.motivoTexto.length > MAXIMO_DE_MOTIVO_TEXTO) e.motivoTexto = `Máximo ${MAXIMO_DE_MOTIVO_TEXTO} caracteres.`;
  if (!e.lineas && !hayCambios(p, f)) e.cambios = 'Todavía no cambiaste nada: el pedido sigue igual.';
  const total = totalDeLaCorreccion(p, f);
  if (!e.lineas && total !== null && total <= 0) e.total = 'El total no puede quedar en cero: para dejar el pedido sin valor, cancélalo.';
  return e;
}

export const hayErrores = (e: ErroresDeCorreccion): boolean => Object.keys(e).length > 0;

/**
 * Argumentos de `venta_corregir`. Solo las filas que ya existían llevan `id` (las nuevas, no). Solo se llama sin errores.
 * `versionEsperada` es la versión que la persona tiene a la vista: si otra corrección se guardó antes, el servidor rechaza.
 */
export function argumentosDeCorreccion(p: PedidoCompletoDto, f: FormularioDeCorreccion): EntradaDe<'venta_corregir'> {
  const existentes = new Set(p.detalle.map((l) => l.id));
  const lineas = sinFilasEnBlanco(f.lineas).map((l) => ({
    ...(existentes.has(l.clave) && { id: l.clave }),
    ...(l.producto && { productoId: l.producto.id }),
    descripcion: l.descripcion.trim(),
    unidad: l.unidad.trim() || 'unidad',
    cantidadMilesimas: l.cantidadMilesimas ?? 0,
    precioUnitarioMilesimas: l.precioUnitarioMilesimas ?? 0,
    afectoIgv: l.afectoIgv,
    ...fichaNormalizada(l),
  }));
  const texto = f.motivoTexto.trim();
  const cambianLineas = lineasCambiaron(p, f);
  return {
    id: p.id,
    versionEsperada: p.version,
    motivoCodigo: f.motivo ?? 'otro',
    ...(texto && { motivoTexto: texto }),
    ...(cambianLineas && { lineas }),
    // Con líneas cambiadas, el total fijado va aunque sea el mismo de antes: «Qué cambia» muestra ese total y el servidor debe dar el mismo.
    ...(f.fijarTotalCentimos !== null && (cambianLineas || f.fijarTotalCentimos !== p.totalCentimos) && { fijarTotalCentimos: f.fijarTotalCentimos }),
  };
}

// --- «Qué cambia» (vista previa en la pantalla; el servidor confirma con su propio resumen) ---

export type FilaDeVistaPrevia = { clave: string; descripcion: string; antes: string | null; despues: string | null };

export type VistaPrevia = {
  filas: FilaDeVistaPrevia[];
  totalAnteriorCentimos: number;
  totalNuevoCentimos: number;
  deltaCentimos: number;
  /** Con la deuda conocida: lo pagado, lo que falta y lo que queda a favor del cliente. */
  pagadoCentimos: number | null;
  faltaCentimos: number | null;
  aFavorCentimos: number | null;
};

const textoDeLinea = (l: { cantidadMilesimas: number | null; unidad: string; precioUnitarioMilesimas: number | null; afectoIgv: boolean } & FichaParcial): string => {
  const ficha = textoDeFicha(l);
  return `${l.cantidadMilesimas === null ? '—' : formatearCantidad(l.cantidadMilesimas, l.unidad)} × S/ ${l.precioUnitarioMilesimas === null ? '—' : milesimasATexto(l.precioUnitarioMilesimas)}${l.afectoIgv ? '' : ' (no afecto)'}${ficha ? ` · ${ficha}` : ''}`;
};

export function vistaPrevia(p: PedidoCompletoDto, f: FormularioDeCorreccion, abonadoCentimos: number | null): VistaPrevia {
  const nuevas = sinFilasEnBlanco(f.lineas);
  const antesPorId = new Map(p.detalle.map((d) => [d.id, d]));
  const filas: FilaDeVistaPrevia[] = [];
  for (const l of nuevas) {
    const d = antesPorId.get(l.clave);
    const despues = textoDeLinea(l);
    if (!d) filas.push({ clave: l.clave, descripcion: l.descripcion, antes: null, despues });
    else if (!mismaLinea(l, d)) filas.push({ clave: l.clave, descripcion: l.descripcion, antes: textoDeLinea(d), despues });
  }
  const vivas = new Set(nuevas.map((l) => l.clave));
  for (const d of p.detalle) if (!vivas.has(d.id)) filas.push({ clave: d.id, descripcion: d.descripcion, antes: textoDeLinea(d), despues: null });
  const total = totalDeLaCorreccion(p, f) ?? p.totalCentimos;
  return {
    filas,
    totalAnteriorCentimos: p.totalCentimos,
    totalNuevoCentimos: total,
    deltaCentimos: total - p.totalCentimos,
    pagadoCentimos: abonadoCentimos,
    faltaCentimos: abonadoCentimos === null ? null : Math.max(0, total - abonadoCentimos),
    aFavorCentimos: abonadoCentimos === null ? null : Math.max(0, abonadoCentimos - total),
  };
}

/** Texto del aviso del servidor cuando el cambio supera lo que puede hacer un trabajador. */
export const AVISO_DE_APROBACION = 'Este cambio es más grande de lo que puedes corregir tú (más del 10 % del total o más de S/ 100). Debe aprobarlo el dueño: pídele que haga la corrección.';

/** Lo que el estado del pedido implica antes de tocar nada. */
export function avisoDeEstado(estado: PedidoCompletoDto['estado']): string | null {
  if (estado === 'en_proceso' || estado === 'listo') return 'El taller ya trabaja: al guardar, reimprime la orden de trabajo v2.';
  if (estado === 'entregado') return 'Pedido entregado: solo se corrigen el precio y el IGV.';
  return null;
}
