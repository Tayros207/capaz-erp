import { describe, expect, it } from 'vitest';
import { centimosSchema, PREFIJO_DE_PRECIOS_CAMBIARON } from '@capaz/shared';
import { ajusteDeFormulario, ajusteParaEnviar, avisosDeRapida, avisosDeRechazoDePrecios, pidePreciosDeHoy, SIN_AJUSTE, textoDeAjusteDeLinea, textoDePrecioDeLista, validarAjuste } from './logica-precio.ts';
import { filaDeHistorial, formularioDesdeCotizacion, lineaParaEnviar, lineaVacia, pideMotivoDeMargen, argumentosDeEmision } from './logica-cotizaciones.ts';

const c = (n: number) => centimosSchema.parse(n);

describe('ajuste de precio', () => {
  it('ninguno, sin monto o monto cero: no se envía ajuste', () => {
    expect(ajusteParaEnviar(SIN_AJUSTE)).toEqual({ tipo: 'ninguno' });
    expect(ajusteParaEnviar({ tipo: 'precio', centimos: null })).toEqual({ tipo: 'ninguno' });
    expect(ajusteParaEnviar({ tipo: 'sumar', centimos: c(0) })).toEqual({ tipo: 'ninguno' });
  });

  it('a mano fija el precio; sumar y restar son un monto con signo', () => {
    expect(ajusteParaEnviar({ tipo: 'precio', centimos: c(50_000) })).toEqual({ tipo: 'precio', importeCentimos: 50_000 });
    expect(ajusteParaEnviar({ tipo: 'sumar', centimos: c(1_000) })).toEqual({ tipo: 'monto', importeCentimos: 1_000 });
    expect(ajusteParaEnviar({ tipo: 'restar', centimos: c(1_000) })).toEqual({ tipo: 'monto', importeCentimos: -1_000 });
  });

  it('el ajuste del servidor vuelve al formulario: el monto negativo es «Restar»', () => {
    expect(ajusteDeFormulario(null)).toEqual(SIN_AJUSTE);
    expect(ajusteDeFormulario({ tipo: 'monto', importeCentimos: -300 })).toEqual({ tipo: 'restar', centimos: 300 });
    expect(ajusteDeFormulario({ tipo: 'monto', importeCentimos: 300 })).toEqual({ tipo: 'sumar', centimos: 300 });
    expect(ajusteDeFormulario({ tipo: 'precio', importeCentimos: 900 })).toEqual({ tipo: 'precio', centimos: 900 });
  });

  it('valida: falta el monto, o restar deja el precio en cero o menos', () => {
    expect(validarAjuste(SIN_AJUSTE)).toBeUndefined();
    expect(validarAjuste({ tipo: 'precio', centimos: null })).toBe('Escribe el precio.');
    expect(validarAjuste({ tipo: 'sumar', centimos: null })).toBe('Escribe el monto.');
    expect(validarAjuste({ tipo: 'restar', centimos: c(58_000) }, 58_000)).toBe('El precio final debe ser mayor que cero.');
    expect(validarAjuste({ tipo: 'restar', centimos: c(57_999) }, 58_000)).toBeUndefined();
  });

  it('textos de la línea ajustada', () => {
    expect(textoDePrecioDeLista(58_000)).toBe('Precio de lista: S/ 580.00');
    expect(textoDeAjusteDeLinea({ tipo: 'precio', importeCentimos: 50_000 })).toBe('A mano: S/ 500.00');
    expect(textoDeAjusteDeLinea({ tipo: 'monto', importeCentimos: -1_500 })).toBe('Resta S/ 15.00');
    expect(textoDeAjusteDeLinea(null)).toBe('');
  });
});

describe('línea de cotización con ajuste', () => {
  const lista = { ...lineaVacia('a'), lista: { id: 'l1', nombre: 'Volantes' }, cantidadMilesimas: 1_000_000 };
  it('la línea de lista envía su ajuste solo si hay', () => {
    expect(lineaParaEnviar(lista)).toEqual({ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 1_000_000 });
    expect(lineaParaEnviar({ ...lista, ajuste: { tipo: 'restar', centimos: c(200) } })).toMatchObject({ ajuste: { tipo: 'monto', importeCentimos: -200 } });
  });

  it('al editar una cotización el ajuste guardado vuelve a la línea', () => {
    const dto = { id: 'x', titulo: 'T', clienteId: null, clienteNombre: null, conOpciones: false, notas: null, costoCentimos: null, condiciones: { validezDias: null, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' },
      lineas: [{ posicion: 0, tipo: 'lista', productoId: null, listaId: 'l1', descripcion: 'V', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5, importeCentimos: 1, igvCentimos: 0, totalCentimos: 1, precioListaCentimos: 100, ajuste: { tipo: 'precio', importeCentimos: 90 } }] };
    expect(formularioDesdeCotizacion(dto as never, c).lineas[0]?.ajuste).toEqual({ tipo: 'precio', centimos: 90 });
  });
});

describe('cotización rápida', () => {
  it('estimación fuera de las referencias; «cambia por tramos» solo en escalón', () => {
    expect(avisosDeRapida({ estimacion: true, escalon: 1_000_000 })).toEqual({ estimacion: true, cambiaPorTramos: true });
    expect(avisosDeRapida({ estimacion: false, escalon: null })).toEqual({ estimacion: false, cambiaPorTramos: false });
  });
});

describe('emitir: preguntas del servidor', () => {
  it('el motivo de margen es un conflicto con mensaje fijo; los precios cambiados, otro con su prefijo', () => {
    expect(pideMotivoDeMargen('conflicto', 'motivo_requerido: el margen está por debajo del mínimo configurado; indica el motivo para poder emitirla.')).toBe(true);
    expect(pideMotivoDeMargen('conflicto', 'Elige el cliente')).toBe(false);
    expect(pidePreciosDeHoy('conflicto', `${PREFIJO_DE_PRECIOS_CAMBIARON} X`)).toBe(true);
    expect(pidePreciosDeHoy('argumentos_invalidos', `${PREFIJO_DE_PRECIOS_CAMBIARON} X`)).toBe(false);
  });

  it('separa los avisos de cada línea y arma los argumentos', () => {
    const m = `${PREFIJO_DE_PRECIOS_CAMBIARON} El precio de lista de «A» cambió: antes S/ 1.00, ahora S/ 2.00. El precio de lista de «B» cambió: antes S/ 3.00, ahora S/ 4.00. Acepta los precios de hoy para emitirla.`;
    expect(avisosDeRechazoDePrecios(m)).toEqual(['El precio de lista de «A» cambió: antes S/ 1.00, ahora S/ 2.00', 'El precio de lista de «B» cambió: antes S/ 3.00, ahora S/ 4.00']);
    expect(argumentosDeEmision('x', undefined, true)).toEqual({ id: 'x', aceptarPreciosDeHoy: true });
    expect(argumentosDeEmision('x', ' motivo ')).toEqual({ id: 'x', motivoMargenBajo: 'motivo' });
  });
});

describe('historial', () => {
  it('lleva el canal («por el enlace») y el detalle: opciones elegidas y nota', () => {
    expect(filaDeHistorial({ tipo: 'aceptada', version: 1, motivo: null, canal: 'enlace', detalle: 'Eligió las líneas 1 y 3' })).toEqual({ titulo: 'Aceptada (versión 1)', canal: 'por el enlace', detalle: ['Eligió las líneas 1 y 3'] });
    expect(filaDeHistorial({ tipo: 'rechazada', version: 2, motivo: 'Muy caro', canal: 'enlace', detalle: null }).detalle).toEqual(['Motivo: Muy caro']);
    expect(filaDeHistorial({ tipo: 'emitida', version: 1, motivo: null, canal: 'ui', detalle: null })).toMatchObject({ canal: '', detalle: [] });
  });
});
