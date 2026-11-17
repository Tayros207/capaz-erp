import { describe, expect, it } from 'vitest';
import { centimosSchema, type ListaDePrecioDto, type ProductoCotizableDto } from '@capaz/shared';
import {
  LISTA_VACIA, argumentosDeAjuste, argumentosDeConfiguracion, argumentosDeCotizacionRapida, argumentosDeCreacionDeLista, argumentosDeEdicionDeLista,
  formularioDeConfiguracion, formularioDeLista, pideConfirmarUnitario, rutaDeCotizacion, soles, textoDeAjuste, unitarioDeReferencia, validarAjusteDeCliente,
  validarCantidadRapida, validarConfiguracion, validarLista, argumentosDeBloque, mensajeDeBloqueAplicado, validarBloque,
} from './logica.ts';

const c = (n: number) => centimosSchema.parse(n);
const lista = (extra: Partial<ListaDePrecioDto> = {}): ListaDePrecioDto => ({
  id: 'l1', productoId: null, productoNombre: null, nombre: 'Volantes', unidad: 'millar', p100Centimos: 4500, p1000Centimos: 25_000, p5000Centimos: 90_000, modoIntermedio: 'curva',
  precioMinimoCentimos: null, aConfirmado: false, preciosFijadosEn: '2026-11-01T10:00:00.000Z', porRevisar: false, archivadoEn: null,
  creadoEn: '2026-11-01T10:00:00.000Z', actualizadoEn: '2026-11-01T10:00:00.000Z', ...extra,
});

describe('lista de precios', () => {
  it('valida nombre, unidad y los tres precios', () => {
    expect(Object.keys(validarLista(LISTA_VACIA)).sort()).toEqual(['nombre', 'p100', 'p1000', 'p5000']);
    expect(validarLista({ ...LISTA_VACIA, nombre: 'A', p100: c(1), p1000: c(2), p5000: c(3) })).toEqual({});
    expect(validarLista({ ...LISTA_VACIA, nombre: 'A', unidad: ' ', p100: c(1), p1000: c(2), p5000: c(3), minimo: c(0) })).toEqual({ unidad: 'Indica la unidad.', minimo: 'El mínimo debe ser mayor que cero.' });
  });
  it('el unitario es el precio entre la cantidad, con cuatro decimales', () => {
    expect(unitarioDeReferencia(4500, 100)).toBe('S/ 0.4500');
    expect(unitarioDeReferencia(25_000, 1000)).toBe('S/ 0.2500');
    expect(unitarioDeReferencia(90_000, 5000)).toBe('S/ 0.1800');
    expect(unitarioDeReferencia(100_000_000, 100)).toBe('S/ 10,000.0000');
    expect(unitarioDeReferencia(null, 100)).toBe('—');
  });
  it('arma el alta con el mínimo solo si hay', () => {
    const f = { ...LISTA_VACIA, nombre: ' Volantes ', p100: c(4500), p1000: c(25_000), p5000: c(90_000) };
    expect(argumentosDeCreacionDeLista(f, false)).toEqual({ nombre: 'Volantes', unidad: 'unidad', p100Centimos: 4500, p1000Centimos: 25_000, p5000Centimos: 90_000, modoIntermedio: 'curva', confirmarUnitarioNoBaja: false });
    expect(argumentosDeCreacionDeLista({ ...f, minimo: c(3000) }, true)).toMatchObject({ precioMinimoCentimos: 3000, confirmarUnitarioNoBaja: true });
  });
  it('la edición manda solo lo que cambió y nulo si nada cambió', () => {
    const l = lista();
    const f = formularioDeLista(l);
    expect(argumentosDeEdicionDeLista(l, f, false)).toBeNull();
    expect(argumentosDeEdicionDeLista(l, { ...f, p100: c(4800), modo: 'escalon' }, true)).toEqual({ id: 'l1', p100Centimos: 4800, modoIntermedio: 'escalon', confirmarUnitarioNoBaja: true });
    expect(argumentosDeEdicionDeLista(lista({ precioMinimoCentimos: 3000 }), { ...f, minimo: null }, false)).toMatchObject({ precioMinimoCentimos: null });
  });
  it('reconoce el aviso del servidor que se confirma con una casilla', () => {
    expect(pideConfirmarUnitario('conflicto', 'El unitario no baja. Confirma para guardarlo igual.')).toBe(true);
    expect(pideConfirmarUnitario('conflicto', 'Ya existe una lista con ese nombre.')).toBe(false);
    expect(pideConfirmarUnitario('argumentos_invalidos', 'Confirma para guardarlo igual.')).toBe(false);
  });
});

describe('cotización rápida', () => {
  it('la cantidad va de 100 a 5.000', () => {
    expect(validarCantidadRapida(null)).toBe('Escribe la cantidad.');
    expect(validarCantidadRapida(99_999)).toMatch(/cotiza de 100 a 5,000/);
    expect(validarCantidadRapida(5_000_001)).toMatch(/aparte/);
    expect(validarCantidadRapida(100_000)).toBeUndefined();
    expect(validarCantidadRapida(2_500_000)).toBeUndefined();
  });
  it('arma la cotización con una línea de la lista y lleva a su ficha', () => {
    const deLista: ProductoCotizableDto = { productoId: 'p1', listaId: 'l1', nombre: 'Volantes', unidad: 'millar', origen: 'lista', lista: lista() };
    expect(argumentosDeCotizacionRapida(deLista, 2_500_000, null)).toEqual({ titulo: 'Volantes', lineas: [{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 2_500_000 }], conOpciones: false });
    expect(argumentosDeCotizacionRapida(deLista, 100_000, { id: 'c1', nombre: 'Imprenta Sol' })).toMatchObject({ titulo: 'Volantes · Imprenta Sol', clienteId: 'c1' });
    const deCatalogo: ProductoCotizableDto = { productoId: 'p2', listaId: null, nombre: 'Banner', unidad: 'm²', origen: 'catalogo', precioCatalogoSinIgvMilesimas: 25_000, afectoIgv: true };
    expect(argumentosDeCotizacionRapida(deCatalogo, 3_000, null)).toEqual({
      titulo: 'Banner', lineas: [{ tipo: 'manual', productoId: 'p2', descripcion: 'Banner', unidad: 'm²', cantidadMilesimas: 3_000, precioUnitarioMilesimas: 25_000 }], conOpciones: false,
    });
    const heredada: ProductoCotizableDto = { productoId: null, listaId: 'l9', nombre: 'Troquel', unidad: 'unidad', origen: 'lista', lista: lista({ id: 'l9' }) };
    expect(argumentosDeCotizacionRapida(heredada, 100_000, null).lineas).toEqual([{ tipo: 'lista', listaId: 'l9', cantidadMilesimas: 100_000 }]);
    expect(rutaDeCotizacion('abc')).toBe('/m/cotizador/cotizaciones/abc');
  });
  it('da formato a los céntimos del servidor', () => {
    expect(soles(250_000)).toBe('S/ 2,500.00');
  });
});

describe('lista de precios enlazada a un producto', () => {
  it('envía el producto al crear y lo cambia o lo quita al editar', () => {
    const f = { ...LISTA_VACIA, producto: { id: 'p1', nombre: 'Banner' }, nombre: 'Banner', p100: c(4500), p1000: c(25_000), p5000: c(90_000) };
    expect(argumentosDeCreacionDeLista(f, false)).toMatchObject({ productoId: 'p1' });
    expect(argumentosDeCreacionDeLista({ ...f, producto: null }, false)).not.toHaveProperty('productoId');
    const l = lista({ productoId: 'p1', productoNombre: 'Banner' });
    expect(formularioDeLista(l).producto).toEqual({ id: 'p1', nombre: 'Banner' });
    expect(argumentosDeEdicionDeLista(l, formularioDeLista(l), false)).toBeNull();
    expect(argumentosDeEdicionDeLista(l, { ...formularioDeLista(l), producto: null }, false)).toMatchObject({ productoId: null });
    expect(argumentosDeEdicionDeLista(l, { ...formularioDeLista(l), producto: { id: 'p2', nombre: 'Otro' } }, false)).toMatchObject({ productoId: 'p2' });
  });
});

describe('ajustes por cliente', () => {
  it('valida cliente y porcentaje con signo entre -100 y 500', () => {
    expect(validarAjusteDeCliente(null, '-5')).toEqual({ cliente: 'Elige un cliente.' });
    expect(validarAjusteDeCliente('c1', '-5,5')).toEqual({});
    expect(validarAjusteDeCliente('c1', '')).toEqual({});
    expect(validarAjusteDeCliente('c1', 'abc').porcentaje).toMatch(/porcentaje/);
    expect(validarAjusteDeCliente('c1', '501').porcentaje).toBe('El porcentaje va de -100 a 500.');
  });
  it('vacío o 0 quita el ajuste', () => {
    expect(argumentosDeAjuste('c1', '-5,5', ' Mayorista ')).toEqual({ clienteId: 'c1', porcentaje: '-5.5', nota: 'Mayorista' });
    expect(argumentosDeAjuste('c1', '', 'x')).toEqual({ clienteId: 'c1', porcentaje: null });
    expect(argumentosDeAjuste('c1', '0', '')).toEqual({ clienteId: 'c1', porcentaje: null });
  });
  it('describe el ajuste en palabras', () => {
    expect(textoDeAjuste('-5')).toBe('Descuento de 5 %');
    expect(textoDeAjuste('10')).toBe('Recargo de 10 %');
    expect(textoDeAjuste('0')).toBe('Sin ajuste');
  });
});

describe('configuración', () => {
  const dto = {
    utilidadPct: '35', utilidadBase: 'venta' as const, umbralVerdePct: '30', umbralMinimoPct: '15', redondeoComercial: '5' as const, igvPorcentaje: 18,
    condiciones: { validezDias: 15, plazoEntrega: '3 días', formaPago: '50 % adelanto', tolerancia: '', noIncluye: '' }, mensajeWhatsapp: null, actualizadoEn: null,
  };
  it('ida y vuelta del formulario', () => {
    const f = formularioDeConfiguracion(dto);
    expect(validarConfiguracion(f)).toEqual({});
    expect(argumentosDeConfiguracion({ ...f, utilidadPct: ' 40,5 ', validezDias: '', mensajeWhatsapp: '  ' })).toMatchObject({
      utilidadPct: '40.5', condiciones: { validezDias: null, plazoEntrega: '3 días' }, mensajeWhatsapp: null, igvPorcentaje: 18,
    });
  });
  it('valida porcentajes, umbrales y días', () => {
    const f = formularioDeConfiguracion(dto);
    expect(validarConfiguracion({ ...f, utilidadPct: 'x' }).utilidadPct).toMatch(/Utilidad/);
    expect(validarConfiguracion({ ...f, umbralMinimoPct: '30' }).umbralMinimoPct).toBe('El margen mínimo debe ser menor que el margen bueno.');
    expect(validarConfiguracion({ ...f, validezDias: '400' }).validezDias).toMatch(/1 a 365/);
  });
});

describe('cambiar en bloque', () => {
  it('valida el porcentaje: con signo, de -90 a 300, distinto de 0 y hasta dos decimales', () => {
    expect(validarBloque({ busqueda: '', porcentaje: '8' })).toEqual({});
    expect(validarBloque({ busqueda: 'couché', porcentaje: ' -5,25 % ' })).toEqual({});
    expect(validarBloque({ busqueda: '', porcentaje: '+300' })).toEqual({});
    expect(validarBloque({ busqueda: '', porcentaje: '' }).porcentaje).toMatch(/Escribe un porcentaje/);
    expect(validarBloque({ busqueda: '', porcentaje: '1.234' }).porcentaje).toMatch(/Escribe un porcentaje/);
    expect(validarBloque({ busqueda: '', porcentaje: '0' }).porcentaje).toBe('El porcentaje no puede ser 0.');
    expect(validarBloque({ busqueda: '', porcentaje: '-91' }).porcentaje).toBe('El porcentaje va de -90 a 300.');
    expect(validarBloque({ busqueda: '', porcentaje: '301' }).porcentaje).toBe('El porcentaje va de -90 a 300.');
    expect(validarBloque({ busqueda: 'x'.repeat(81), porcentaje: '5' }).busqueda).toMatch(/80/);
  });
  it('arma los argumentos limpios: coma por punto, sin «+» ni «%» y la confirmación', () => {
    expect(argumentosDeBloque({ busqueda: '  couché ', porcentaje: '+8,5 %' }, false)).toEqual({ busqueda: 'couché', porcentaje: '8.5', confirmarUnitarioNoBaja: false });
    expect(argumentosDeBloque({ busqueda: '', porcentaje: '-5' }, true)).toEqual({ busqueda: '', porcentaje: '-5', confirmarUnitarioNoBaja: true });
  });
  it('el mensaje final cuenta las listas y recuerda que lo emitido no cambia', () => {
    expect(mensajeDeBloqueAplicado(1, '8')).toBe('1 lista cambió +8 %. Las cotizaciones ya emitidas no cambian.');
    expect(mensajeDeBloqueAplicado(3, '-5')).toBe('3 listas cambiaron -5 %. Las cotizaciones ya emitidas no cambian.');
  });
});
