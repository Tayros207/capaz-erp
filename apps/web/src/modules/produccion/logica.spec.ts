import { describe, expect, it } from 'vitest';
import { centimosSchema } from '@capaz/shared';
import {
  accionesDeOrden,
  argumentosDeCrear,
  argumentosDeEditar,
  atajosDeEntrega,
  avanceDe,
  coincide,
  faltaCancelar,
  lineaVacia,
  mensajeDeRechazo,
  subtotalDeLinea,
  sumarDias,
  textoDeEntrega,
  totalDeFormulario,
  validarOrden,
  type FormularioDeOrden,
} from './logica.ts';

const HOY = '2026-03-10';
const form = (c: Partial<FormularioDeOrden> = {}): FormularioDeOrden => ({
  cliente: { id: 'c1', nombre: 'Cristina' },
  lineas: [{ ...lineaVacia(1), descripcion: 'Volantes', cantidad: 1_000_000, precio: 240, material: ' couché ' }],
  adelanto: centimosSchema.parse(10_000),
  entregaEl: '',
  notas: '',
  ...c,
});

describe('montos del formulario', () => {
  it('el subtotal sale redondeado al céntimo como en el servidor', () => {
    expect(subtotalDeLinea({ cantidad: 1_000_000, precio: 240 })).toBe(24_000);
    expect(subtotalDeLinea({ cantidad: 333_000, precio: 1_005 })).toBe(33_467);
    expect(subtotalDeLinea({ cantidad: null, precio: 240 })).toBe(0);
  });
  it('el total suma las líneas y la falta cancelar nunca baja de cero', () => {
    expect(totalDeFormulario(form())).toBe(24_000);
    expect(faltaCancelar(form())).toBe(14_000);
    expect(faltaCancelar(form({ adelanto: centimosSchema.parse(99_999) }))).toBe(0);
    expect(faltaCancelar(form({ adelanto: null }))).toBe(24_000);
  });
});

describe('validarOrden', () => {
  it('una orden completa no tiene errores', () => expect(validarOrden(form(), HOY)).toEqual({}));
  it('pide cliente y al menos un trabajo completo', () => {
    expect(validarOrden(form({ cliente: null }), HOY).cliente).toBeDefined();
    expect(validarOrden(form({ lineas: [lineaVacia(1)] }), HOY).lineas).toMatch(/al menos un trabajo/);
    expect(validarOrden(form({ lineas: [{ ...lineaVacia(1), cantidad: 5, precio: 5 }] }), HOY).lineas).toMatch(/descripción/);
    expect(validarOrden(form({ lineas: [{ ...lineaVacia(1), descripcion: 'X', precio: 5 }] }), HOY).lineas).toMatch(/cantidad/);
    expect(validarOrden(form({ lineas: [{ ...lineaVacia(1), descripcion: 'X', cantidad: 5 }] }), HOY).lineas).toMatch(/cuánto vale/);
  });
  it('el adelanto no pasa del total y la entrega no es del pasado', () => {
    expect(validarOrden(form({ adelanto: centimosSchema.parse(24_001) }), HOY).adelanto).toMatch(/mayor que el total/);
    expect(validarOrden(form({ adelanto: centimosSchema.parse(24_000) }), HOY).adelanto).toBeUndefined();
    expect(validarOrden(form({ entregaEl: '2026-03-09' }), HOY).entregaEl).toBeDefined();
    expect(validarOrden(form({ entregaEl: HOY }), HOY).entregaEl).toBeUndefined();
  });
  it('las líneas vacías sobrantes no estorban', () => expect(validarOrden(form({ lineas: [...form().lineas, lineaVacia(2)] }), HOY)).toEqual({}));
});

describe('argumentos', () => {
  it('crear manda solo lo lleno y recorta los textos', () => {
    const a = argumentosDeCrear(form({ lineas: [...form().lineas, lineaVacia(2)], notas: ' Recoge el sábado ', entregaEl: '2026-03-20' }));
    expect(a).toEqual({
      clienteId: 'c1',
      lineas: [{ descripcion: 'Volantes', cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 240, material: 'couché' }],
      adelantoCentimos: 10_000,
      entregaEl: '2026-03-20',
      notas: 'Recoge el sábado',
    });
    expect(argumentosDeCrear(form({ adelanto: null })).adelantoCentimos).toBe(0);
  });
  it('editar manda todo y «sin fecha» borra la entrega', () => {
    const a = argumentosDeEditar('o1', form());
    expect(a).toMatchObject({ id: 'o1', clienteId: 'c1', adelantoCentimos: 10_000, entregaEl: null, notas: null });
  });
});

describe('estados y acciones', () => {
  it('el botón de avance lleva al siguiente estado y entregar pide confirmación', () => {
    expect(avanceDe('pendiente')).toEqual({ texto: 'Pasar a máquina', a: 'en_maquina', confirma: false });
    expect(avanceDe('en_maquina')?.a).toBe('listo');
    expect(avanceDe('listo')).toMatchObject({ a: 'entregado', confirma: true });
    expect(avanceDe('anulada')).toMatchObject({ texto: 'Retomar este trabajo', a: 'pendiente' });
    expect(avanceDe('entregado')).toBeNull();
  });
  it('qué se puede hacer según el estado y el saldo', () => {
    expect(accionesDeOrden({ estado: 'listo', saldoCentimos: 100 })).toEqual({ editar: true, anular: true, cobrar: true });
    expect(accionesDeOrden({ estado: 'listo', saldoCentimos: 0 }).cobrar).toBe(false);
    expect(accionesDeOrden({ estado: 'entregado', saldoCentimos: 100 })).toEqual({ editar: false, anular: false, cobrar: true });
    expect(accionesDeOrden({ estado: 'anulada', saldoCentimos: 100 })).toEqual({ editar: false, anular: false, cobrar: false });
  });
});

describe('fechas', () => {
  const o = (estado: 'pendiente' | 'entregado' | 'anulada', entregaEl: string | null, entregadoEn: string | null = null) => ({ estado, entregaEl, entregadoEn });
  it('dice cuándo se entrega o cuánto se atrasó', () => {
    expect(textoDeEntrega(o('pendiente', null), HOY)).toBe('Sin fecha de entrega');
    expect(textoDeEntrega(o('pendiente', '2026-03-09'), HOY)).toBe('Atrasada 1 día');
    expect(textoDeEntrega(o('pendiente', '2026-03-07'), HOY)).toBe('Atrasada 3 días');
    expect(textoDeEntrega(o('pendiente', HOY), HOY)).toBe('Entrega hoy');
    expect(textoDeEntrega(o('pendiente', '2026-03-11'), HOY)).toBe('Entrega mañana');
    expect(textoDeEntrega(o('pendiente', '2026-03-20'), HOY)).toBe('Entrega el 20/03/2026');
    expect(textoDeEntrega(o('entregado', null, '2026-03-05T15:00:00.000Z'), HOY)).toBe('Entregada el 05/03/2026');
    expect(textoDeEntrega(o('anulada', '2026-03-20'), HOY)).toBe('Anulada');
  });
  it('los atajos y sumarDias cruzan fin de mes', () => {
    expect(sumarDias('2026-02-27', 3)).toBe('2026-03-02');
    expect(atajosDeEntrega(HOY).map((a) => [a.texto, a.dia])).toEqual([['Hoy', HOY], ['Mañana', '2026-03-11'], ['En 3 días', '2026-03-13'], ['En una semana', '2026-03-17']]);
  });
});

describe('búsqueda y mensajes', () => {
  const orden = { clienteNombre: 'Cristina Neira', codigo: 'OT-2026-0007', resumen: 'Millar de volantes', notas: null };
  it('busca sin tildes ni mayúsculas', () => {
    expect(coincide(orden, 'CRISTINA')).toBe(true);
    expect(coincide(orden, 'ot-2026-0007')).toBe(true);
    expect(coincide(orden, 'volantés')).toBe(true);
    expect(coincide(orden, 'tarjetas')).toBe(false);
    expect(coincide(orden, '  ')).toBe(true);
  });
  it('conserva el mensaje del servidor en los conflictos', () => {
    expect(mensajeDeRechazo('conflicto', 'La orden ya se entregó y no se puede editar.')).toBe('La orden ya se entregó y no se puede editar.');
    expect(mensajeDeRechazo('sin_permiso', 'x')).toMatch(/No tienes permiso/);
  });
});
