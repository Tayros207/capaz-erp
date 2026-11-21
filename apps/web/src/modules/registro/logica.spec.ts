import { describe, expect, it } from 'vitest';
import { filaConCantidad, filaDeCatalogo, filaLibre } from './logica-lineas.ts';
import type { CategoriaDto, Centimos, CuentaDto } from '@capaz/shared';
import {
  abonoInicial, argumentosDeAbono, argumentosDeCuentaEditada, argumentosDeCuentaNueva, argumentosDeEdicionDeDeuda, argumentosDeListadoDeDeudas, cuentaEnBlanco,
  estaAbierta, formularioDeCuenta, formularioDeDeuda, pasoDeDeuda, textoDeEstadoDeDeuda, tonoDeEstadoDeDeuda, validarAbono, validarCuenta, validarDeuda, validarMotivo, validarNombre,
  argumentosDeListado, argumentosDeAdelanto, argumentosDeMovimiento, faltaCancelar, categoriasDe, debeIniciar, detalleDeMovimiento, diaEnZona, errorDeRango, FILTROS_VACIOS, formatearDia,
  conAdelantoActivado, formularioInicial, llevaProductos, mensajeDeRechazo, montoConSigno, montoDelFormulario, siguienteFormulario, validarMovimiento,
  argumentosDeDeudaNueva, deudaNuevaEnBlanco, textoDeFijosCopiados, validarDeudaNueva,
  argumentosDeTransferencia, cuentasDeDestino, esCategoriaDeTransferencia, esTransferencia, invertirTransferencia, puedeTransferir, siguienteTransferencia,
  textoDeTransferenciasNetas, transferenciaInicial, validarTransferencia,
} from './logica.ts';

const c = (n: number) => n as Centimos;
const cuenta = (id: string, extra: Partial<CuentaDto> = {}): CuentaDto => ({
  id, nombre: id, tipo: 'caja', sucursalId: null, esPrincipal: false, saldoInicialCentimos: 0, saldoCentimos: 0, archivadoEn: null,
  creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z', ...extra,
});
const HOY = '2026-03-10';

describe('fechas', () => {
  it('el día se toma en la zona de la empresa, no en UTC', () => {
    expect(diaEnZona(new Date('2026-03-11T04:30:00Z'))).toBe('2026-03-10');
    expect(diaEnZona(new Date('2026-03-11T05:00:00Z'))).toBe('2026-03-11');
    expect(diaEnZona(new Date('2026-01-01T02:00:00Z'))).toBe('2025-12-31');
  });
  it('muestra el día como día/mes/año', () => {
    expect(formatearDia('2026-03-10')).toBe('10/03/2026');
    expect(formatearDia('raro')).toBe('raro');
  });
});

describe('signo y tono de los montos', () => {
  it('el ingreso suma y el egreso resta; el anulado pierde el tono', () => {
    expect(montoConSigno({ tipo: 'ingreso', montoCentimos: 15_000, estado: 'activo' })).toEqual({ texto: '+ S/ 150.00', tono: 'exito', anulado: false });
    expect(montoConSigno({ tipo: 'egreso', montoCentimos: 4_550, estado: 'activo' })).toEqual({ texto: '− S/ 45.50', tono: 'peligro', anulado: false });
    expect(montoConSigno({ tipo: 'egreso', montoCentimos: 1, estado: 'anulado' })).toEqual({ texto: '− S/ 0.01', tono: 'neutro', anulado: true });
  });
  it('el detalle es la descripción o, si falta, el contacto', () => {
    expect(detalleDeMovimiento({ descripcion: 'Tinta', contactoNombre: 'José' })).toBe('Tinta');
    expect(detalleDeMovimiento({ descripcion: null, contactoNombre: 'José' })).toBe('José');
    expect(detalleDeMovimiento({ descripcion: null, contactoNombre: null })).toBe('—');
  });
});

describe('formulario de movimiento', () => {
  const cuentas = [cuenta('banco', { tipo: 'banco' }), cuenta('caja', { esPrincipal: true }), cuenta('vieja', { archivadoEn: '2026-02-01T00:00:00.000Z' })];

  it('empieza con la fecha de hoy, la cuenta principal y efectivo', () => {
    expect(formularioInicial('egreso', HOY, cuentas)).toEqual({ tipo: 'egreso', monto: null, fecha: HOY, cuentaId: 'caja', categoriaId: '', contacto: null, medioDePago: 'efectivo', descripcion: '', conAdelanto: false, adelanto: null, venceEn: '', productos: [] });
    expect(formularioInicial('ingreso', HOY, [cuentas[2]!, cuentas[0]!]).cuentaId).toBe('banco');
    expect(formularioInicial('ingreso', HOY, []).cuentaId).toBe('');
  });

  it('valida el monto y la fecha', () => {
    const base = formularioInicial('ingreso', HOY, cuentas);
    expect(validarMovimiento(base, HOY)).toEqual({ monto: 'Escribe el monto.' });
    expect(validarMovimiento({ ...base, monto: c(0) }, HOY)).toEqual({ monto: 'El monto debe ser mayor que cero.' });
    expect(validarMovimiento({ ...base, monto: c(100), fecha: '2026-03-11' }, HOY)).toEqual({ fecha: 'La fecha no puede ser futura.' });
    expect(validarMovimiento({ ...base, monto: c(100), fecha: '' }, HOY)).toEqual({ fecha: 'Elige la fecha.' });
    expect(validarMovimiento({ ...base, monto: c(100), descripcion: 'x'.repeat(501) }, HOY)).toHaveProperty('descripcion');
    expect(validarMovimiento({ ...base, monto: c(100) }, HOY)).toEqual({});
  });

  it('arma los argumentos solo con lo elegido, en céntimos enteros', () => {
    const base = { ...formularioInicial('egreso', HOY, cuentas), monto: c(4_550) };
    expect(argumentosDeMovimiento(base)).toEqual({ tipo: 'egreso', montoCentimos: 4_550, fecha: HOY, medioDePago: 'efectivo', cuentaId: 'caja' });
    expect(argumentosDeMovimiento({ ...base, cuentaId: '', categoriaId: 'cat', contacto: { id: 'cli', nombre: 'José' }, medioDePago: 'yape', descripcion: '  Tinta  ' })).toEqual({
      tipo: 'egreso', montoCentimos: 4_550, fecha: HOY, medioDePago: 'yape', categoriaId: 'cat', contactoId: 'cli', descripcion: 'Tinta',
    });
    expect(() => argumentosDeMovimiento({ ...base, monto: null })).toThrow();
  });

  it('con adelanto el monto es el total, falta cancelar es la resta y se pide contacto y un adelanto menor al total', () => {
    const base = { ...formularioInicial('ingreso', HOY, cuentas), monto: c(24_000), conAdelanto: true, adelanto: c(10_000), contacto: { id: 'cli', nombre: 'Cristina' } };
    expect(faltaCancelar(base)).toBe(14_000);
    expect(faltaCancelar({ ...base, adelanto: null })).toBe(24_000);
    expect(faltaCancelar({ ...base, adelanto: c(30_000) })).toBe(0);
    expect(validarMovimiento(base, HOY)).toEqual({});
    expect(validarMovimiento({ ...base, contacto: null }, HOY)).toHaveProperty('contacto');
    expect(validarMovimiento({ ...base, adelanto: null }, HOY).adelanto).toMatch(/cuánto dejó a cuenta/);
    expect(validarMovimiento({ ...base, adelanto: c(24_000) }, HOY).adelanto).toMatch(/menor que el total/);
    expect(validarMovimiento({ ...base, venceEn: '2026-03-01' }, HOY)).toHaveProperty('venceEn');
    // Sin la casilla, el adelanto y el contacto no se exigen.
    expect(validarMovimiento({ ...base, conAdelanto: false, adelanto: null, contacto: null }, HOY)).toEqual({});
  });

  it('un ingreso con adelanto arma una deuda por cobrar y un egreso una por pagar, con el concepto del contacto si no se escribe', () => {
    const base = { ...formularioInicial('ingreso', HOY, cuentas), monto: c(24_000), conAdelanto: true, adelanto: c(10_000), contacto: { id: 'cli', nombre: 'Cristina' }, venceEn: '2026-03-20' };
    expect(argumentosDeAdelanto(base)).toEqual({ tipo: 'por_cobrar', contactoId: 'cli', concepto: 'Venta a Cristina', totalCentimos: 24_000, adelantoCentimos: 10_000, fecha: HOY, medioDePago: 'efectivo', cuentaId: 'caja', venceEn: '2026-03-20' });
    const egreso = argumentosDeAdelanto({ ...base, tipo: 'egreso', descripcion: ' Papel ', venceEn: '' });
    expect(egreso).toMatchObject({ tipo: 'por_pagar', concepto: 'Papel' });
    expect(egreso).not.toHaveProperty('venceEn');
    expect(() => argumentosDeAdelanto({ ...base, contacto: null })).toThrow();
  });

  it('tras guardar queda listo para el siguiente, con el mismo tipo, fecha, cuenta y medio', () => {
    const lleno = { ...formularioInicial('egreso', '2026-03-09', cuentas), monto: c(100), categoriaId: 'cat', contacto: { id: 'cli', nombre: 'José' }, medioDePago: 'yape' as const, descripcion: 'Tinta' };
    expect(siguienteFormulario(lleno)).toEqual({ tipo: 'egreso', monto: null, fecha: '2026-03-09', cuentaId: 'caja', categoriaId: '', contacto: null, medioDePago: 'yape', descripcion: '', conAdelanto: false, adelanto: null, venceEn: '', productos: [] });
  });

  it('ofrece solo las categorías vivas del tipo', () => {
    const cats: CategoriaDto[] = [
      { id: '1', nombre: 'Ventas', tipo: 'ingreso', archivadoEn: null },
      { id: '2', nombre: 'Compras', tipo: 'egreso', archivadoEn: null },
      { id: '3', nombre: 'Vieja', tipo: 'egreso', archivadoEn: '2026-01-01T00:00:00.000Z' },
    ];
    expect(categoriasDe('egreso', cats).map((x) => x.id)).toEqual(['2']);
    expect(categoriasDe('ingreso', cats).map((x) => x.id)).toEqual(['1']);
  });
});

describe('listado', () => {
  it('los filtros vacíos no viajan y se piden también los anulados', () => {
    expect(argumentosDeListado(FILTROS_VACIOS, 25)).toEqual({ limite: 25, estado: 'todos' });
    expect(argumentosDeListado({ desde: '2026-03-01', hasta: '2026-03-31', tipo: 'egreso', cuentaId: 'caja', estado: 'todos' }, 25, 'abc')).toEqual({
      limite: 25, estado: 'todos', desde: '2026-03-01', hasta: '2026-03-31', tipo: 'egreso', cuentaId: 'caja', cursor: 'abc',
    });
  });
  it('la papelera pide solo los anulados y el filtro «solo vigentes» solo los activos', () => {
    expect(argumentosDeListado({ ...FILTROS_VACIOS, estado: 'anulados' }, 25)).toEqual({ limite: 25, estado: 'anulados' });
    expect(argumentosDeListado({ ...FILTROS_VACIOS, estado: 'activos' }, 25)).toEqual({ limite: 25, estado: 'activos' });
  });
  it('avisa de un rango al revés', () => {
    expect(errorDeRango({ desde: '2026-03-10', hasta: '2026-03-01' })).toBe('La fecha final es anterior a la inicial.');
    expect(errorDeRango({ desde: '2026-03-01', hasta: '2026-03-01' })).toBeUndefined();
    expect(errorDeRango({ desde: '', hasta: '2026-03-01' })).toBeUndefined();
  });
  it('prepara los catálogos solo si no hay cuentas y la persona puede editar', () => {
    expect(debeIniciar([], true)).toBe(true);
    expect(debeIniciar([], false)).toBe(false);
    expect(debeIniciar(undefined, true)).toBe(false);
    expect(debeIniciar([{}], true)).toBe(false);
  });
});

describe('mensajes por código de error', () => {
  it('traduce los de acceso y deja pasar los de negocio', () => {
    expect(mensajeDeRechazo('modulo_solo_lectura', 'x')).toContain('solo lectura');
    expect(mensajeDeRechazo('modulo_no_disponible', 'x')).toContain('no tiene activo');
    expect(mensajeDeRechazo('sin_permiso', 'No tienes permiso para usar «x».')).toBe('No tienes permiso para hacer esto.');
    expect(mensajeDeRechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.')).toBe('Tu acceso es solo a tus propios registros.');
    expect(mensajeDeRechazo('sin_permiso', 'Solo quien ve todos los registros puede marcar un pago fijo.')).toBe('Solo quien ve todos los registros puede marcar un pago fijo.');
    expect(mensajeDeRechazo('conflicto', 'La cuenta «BCP» está archivada.')).toBe('La cuenta «BCP» está archivada.');
    expect(mensajeDeRechazo('argumentos_invalidos', 'La fecha de un movimiento no puede ser futura.')).toBe('La fecha de un movimiento no puede ser futura.');
  });
});

describe('pago fijo sin vencimiento', () => {
  it('al editar una deuda no deja marcar un pago fijo sin fecha', () => {
    expect(validarDeuda({ concepto: 'Alquiler', venceEn: '', notas: '', fijo: true }).venceEn).toBe('Un pago fijo necesita fecha de vencimiento.');
    expect(validarDeuda({ concepto: 'Alquiler', venceEn: '2026-12-05', notas: '', fijo: true })).toEqual({});
    expect(validarDeuda({ concepto: 'Alquiler', venceEn: '', notas: '', fijo: false })).toEqual({});
  });
  it('al anotar una deuda nueva tampoco', () => {
    const f = { ...deudaNuevaEnBlanco(), contacto: { id: 'x', nombre: 'Proveedor de prueba' }, concepto: 'Luz', total: c(10_000), fijo: true };
    expect(validarDeudaNueva(f, '2026-03-10')).toEqual({ venceEn: 'Un pago fijo necesita fecha de vencimiento.' });
    expect(validarDeudaNueva({ ...f, venceEn: '2026-03-20' }, '2026-03-10')).toEqual({});
  });
});

describe('deudas', () => {
  it('textos y tonos de estado; vencida pesa más', () => {
    expect(textoDeEstadoDeDeuda({ estado: 'parcial', vencida: false })).toBe('Parcial');
    expect(textoDeEstadoDeDeuda({ estado: 'pendiente', vencida: true })).toBe('Pendiente · Vencida');
    expect(tonoDeEstadoDeDeuda({ estado: 'pendiente', vencida: true })).toBe('peligro');
    expect(tonoDeEstadoDeDeuda({ estado: 'pagada', vencida: false })).toBe('exito');
    expect(tonoDeEstadoDeDeuda({ estado: 'anulada', vencida: false })).toBe('neutro');
  });
  it('paso de la barra y si está abierta', () => {
    expect(['pendiente', 'parcial', 'pagada', 'anulada'].map((e) => pasoDeDeuda(e as 'pendiente'))).toEqual([0, 1, 2, -1]);
    expect(estaAbierta({ estado: 'parcial' })).toBe(true);
    expect(estaAbierta({ estado: 'pagada' })).toBe(false);
  });
  it('listado de deudas: el cursor solo viaja si existe', () => {
    expect(argumentosDeListadoDeDeudas('por_cobrar', 'abiertas', 25)).toEqual({ tipo: 'por_cobrar', estado: 'abiertas', limite: 25 });
    expect(argumentosDeListadoDeDeudas('por_pagar', 'todas', 25, 'c1')).toEqual({ tipo: 'por_pagar', estado: 'todas', limite: 25, cursor: 'c1' });
  });
  it('abono: precarga el saldo, la cuenta principal y efectivo', () => {
    const f = abonoInicial(c(5000), HOY, [cuenta('a'), cuenta('b', { esPrincipal: true })]);
    expect(f).toEqual({ monto: 5000, fecha: HOY, cuentaId: 'b', medioDePago: 'efectivo', descripcion: '' });
  });
  it('abono: valida monto, tope de saldo y fecha', () => {
    const base = abonoInicial(c(5000), HOY, [cuenta('a')]);
    expect(validarAbono(base, 5000, HOY)).toEqual({});
    expect(validarAbono({ ...base, monto: null }, 5000, HOY).monto).toMatch(/Escribe/);
    expect(validarAbono({ ...base, monto: c(0) }, 5000, HOY).monto).toMatch(/mayor que cero/);
    expect(validarAbono({ ...base, monto: c(5001) }, 5000, HOY).monto).toMatch(/superar el saldo/);
    expect(validarAbono({ ...base, fecha: '2026-03-11' }, 5000, HOY).fecha).toMatch(/futura/);
    expect(validarAbono({ ...base, fecha: '' }, 5000, HOY).fecha).toMatch(/Elige/);
  });
  it('abono: arma los argumentos sin campos vacíos', () => {
    const f = { ...abonoInicial(c(300), HOY, [cuenta('a')]), descripcion: '  adelanto  ' };
    expect(argumentosDeAbono('d1', f)).toEqual({ id: 'd1', montoCentimos: 300, fecha: HOY, medioDePago: 'efectivo', cuentaId: 'a', descripcion: 'adelanto' });
    expect(() => argumentosDeAbono('d1', { ...f, monto: null })).toThrow();
  });
  it('edición de deuda: solo viaja lo que cambió; vaciar manda null', () => {
    const orig = { concepto: 'Venta', venceEn: '2026-04-01', notas: null, fijo: false };
    expect(argumentosDeEdicionDeDeuda('d', formularioDeDeuda(orig), orig)).toBeNull();
    expect(argumentosDeEdicionDeDeuda('d', { concepto: 'Venta', venceEn: '', notas: 'x', fijo: false }, orig)).toEqual({ id: 'd', venceEn: null, notas: 'x' });
    expect(validarDeuda({ concepto: ' ', venceEn: '', notas: '', fijo: false }).concepto).toMatch(/concepto/);
    expect(validarDeuda({ concepto: 'a', venceEn: 'mañana', notas: '', fijo: false }).venceEn).toBeDefined();
  });
  it('marcar o desmarcar «pago fijo» viaja como cambio', () => {
    const orig = { concepto: 'Alquiler', venceEn: null, notas: null, fijo: false };
    expect(argumentosDeEdicionDeDeuda('d', { ...formularioDeDeuda(orig), fijo: true }, orig)).toEqual({ id: 'd', fijo: true });
    expect(argumentosDeEdicionDeDeuda('d', { ...formularioDeDeuda({ ...orig, fijo: true }), fijo: false }, { ...orig, fijo: true })).toEqual({ id: 'd', fijo: false });
  });
  it('motivo de anulación', () => {
    expect(validarMotivo('  ')).toBeDefined();
    expect(validarMotivo('x'.repeat(301))).toBeDefined();
    expect(validarMotivo('error de digitación')).toBeUndefined();
  });
});

describe('cuentas y categorías', () => {
  it('valida nombre y arma argumentos', () => {
    expect(validarNombre(' ')).toBeDefined();
    expect(validarNombre('x'.repeat(81))).toBeDefined();
    expect(validarCuenta({ nombre: 'Caja chica', tipo: 'caja', saldoInicial: null })).toEqual({});
    expect(argumentosDeCuentaNueva({ nombre: ' Caja ', tipo: 'banco', saldoInicial: c(1000) })).toEqual({ nombre: 'Caja', tipo: 'banco', saldoInicialCentimos: 1000 });
    expect(argumentosDeCuentaNueva(cuentaEnBlanco()).saldoInicialCentimos).toBe(0);
    expect(argumentosDeCuentaEditada('c', { nombre: 'Yape', tipo: 'billetera', saldoInicial: c(5) })).toEqual({ id: 'c', nombre: 'Yape', tipo: 'billetera' });
    expect(formularioDeCuenta(cuenta('z', { saldoInicialCentimos: 700 })).saldoInicial).toBe(700);
  });
});

describe('nueva deuda a mano', () => {
  const completa = { ...deudaNuevaEnBlanco(), contacto: { id: 'c1', nombre: 'Juan' }, concepto: ' Volantes ', total: c(20_000) };

  it('pide contacto, concepto y total', () => {
    expect(validarDeudaNueva(deudaNuevaEnBlanco(), HOY)).toEqual({ contacto: 'Elige el cliente o proveedor.', concepto: 'Indica el concepto.', total: 'Escribe el total.' });
    expect(validarDeudaNueva({ ...completa, total: c(0) }, HOY)).toEqual({ total: 'El total debe ser mayor que cero.' });
    expect(validarDeudaNueva(completa, HOY)).toEqual({});
  });
  it('el vencimiento es opcional pero no puede ser anterior a hoy', () => {
    expect(validarDeudaNueva({ ...completa, venceEn: '2026-03-09' }, HOY)).toEqual({ venceEn: 'El vencimiento no puede ser anterior a hoy.' });
    expect(validarDeudaNueva({ ...completa, venceEn: HOY }, HOY)).toEqual({});
    expect(validarDeudaNueva({ ...completa, venceEn: 'mañana' }, HOY)).toHaveProperty('venceEn');
  });
  it('arma los argumentos sin lo vacío y con el tipo de la pantalla', () => {
    expect(argumentosDeDeudaNueva('por_cobrar', completa)).toEqual({ tipo: 'por_cobrar', contactoId: 'c1', concepto: 'Volantes', totalCentimos: 20_000 });
    expect(argumentosDeDeudaNueva('por_pagar', { ...completa, venceEn: '2026-04-01', notas: ' x ' })).toEqual({
      tipo: 'por_pagar', contactoId: 'c1', concepto: 'Volantes', totalCentimos: 20_000, venceEn: '2026-04-01', notas: 'x',
    });
    expect(() => argumentosDeDeudaNueva('por_cobrar', deudaNuevaEnBlanco())).toThrow();
  });
  it('«pago fijo» solo viaja en las deudas por pagar', () => {
    expect(argumentosDeDeudaNueva('por_pagar', { ...completa, fijo: true }).fijo).toBe(true);
    expect(argumentosDeDeudaNueva('por_pagar', completa)).not.toHaveProperty('fijo');
    expect(argumentosDeDeudaNueva('por_cobrar', { ...completa, fijo: true })).not.toHaveProperty('fijo');
  });
});

describe('copiar pagos fijos', () => {
  it('cuenta lo copiado y lo que ya estaba', () => {
    expect(textoDeFijosCopiados({ mes: '2026-12', creadas: 0, yaExistian: 3 })).toBe('Los pagos fijos de 2026-12 ya estaban anotados.');
    expect(textoDeFijosCopiados({ mes: '2026-12', creadas: 1, yaExistian: 0 })).toBe('Se copiaron 1 pago fijo a 2026-12.');
    expect(textoDeFijosCopiados({ mes: '2026-12', creadas: 4, yaExistian: 2 })).toBe('Se copiaron 4 pagos fijos a 2026-12 (2 ya estaban anotados).');
  });
});

describe('transferencia entre cuentas', () => {
  const cuentas = [cuenta('banco', { tipo: 'banco' }), cuenta('caja', { esPrincipal: true }), cuenta('vieja', { archivadoEn: '2026-02-01T00:00:00.000Z' })];

  it('sale de la principal y llega a otra cuenta en uso; necesita dos cuentas vivas', () => {
    expect(transferenciaInicial(HOY, cuentas)).toEqual({ origenId: 'caja', destinoId: 'banco', monto: null, fecha: HOY, nota: '' });
    expect(transferenciaInicial(HOY, [cuentas[1]!]).destinoId).toBe('');
    expect(puedeTransferir(cuentas)).toBe(true);
    expect(puedeTransferir([cuentas[1]!, cuentas[2]!])).toBe(false);
    expect(cuentasDeDestino(cuentas, 'caja').map((x) => x.id)).toEqual(['banco']);
  });

  it('valida cuentas distintas, monto y fecha', () => {
    const base = { ...transferenciaInicial(HOY, cuentas), monto: c(20_001) };
    expect(validarTransferencia(base, HOY)).toEqual({});
    expect(validarTransferencia({ ...base, destinoId: 'caja' }, HOY)).toEqual({ destinoId: 'El destino debe ser otra cuenta.' });
    expect(validarTransferencia({ ...base, destinoId: '', origenId: '' }, HOY)).toEqual({ origenId: 'Elige la cuenta de origen.', destinoId: 'Elige la cuenta de destino.' });
    expect(validarTransferencia({ ...base, monto: null }, HOY)).toEqual({ monto: 'Escribe el monto.' });
    expect(validarTransferencia({ ...base, monto: c(0) }, HOY)).toEqual({ monto: 'El monto debe ser mayor que cero.' });
    expect(validarTransferencia({ ...base, fecha: '2026-03-11' }, HOY)).toEqual({ fecha: 'La fecha no puede ser futura.' });
    expect(validarTransferencia({ ...base, nota: 'x'.repeat(501) }, HOY)).toHaveProperty('nota');
  });

  it('arma los argumentos sin la nota vacía; invertir y repetir conservan lo que corresponde', () => {
    const f = { ...transferenciaInicial(HOY, cuentas), monto: c(20_001) };
    expect(argumentosDeTransferencia(f)).toEqual({ origenId: 'caja', destinoId: 'banco', montoCentimos: 20_001, fecha: HOY });
    expect(argumentosDeTransferencia({ ...f, nota: ' Depósito ' })).toHaveProperty('nota', 'Depósito');
    expect(() => argumentosDeTransferencia({ ...f, monto: null })).toThrow();
    expect(invertirTransferencia(f)).toMatchObject({ origenId: 'banco', destinoId: 'caja' });
    expect(siguienteTransferencia({ ...f, nota: 'x' })).toEqual({ ...f, monto: null, nota: '' });
  });

  it('una pata de transferencia no tiene tono de ganancia ni de gasto; la categoría del sistema no se ofrece', () => {
    const pata = { montoCentimos: 20_001, transferenciaId: 't1' };
    expect(montoConSigno({ ...pata, tipo: 'egreso', estado: 'activo' })).toEqual({ texto: '− S/ 200.01', tono: 'suave', anulado: false });
    expect(montoConSigno({ ...pata, tipo: 'ingreso', estado: 'activo' })).toEqual({ texto: '+ S/ 200.01', tono: 'suave', anulado: false });
    expect(montoConSigno({ ...pata, tipo: 'ingreso', estado: 'anulado' }).tono).toBe('neutro');
    expect(esTransferencia({ transferenciaId: 't1' })).toBe(true);
    expect(esTransferencia({ transferenciaId: null })).toBe(false);
    const categorias: CategoriaDto[] = [
      { id: '1', nombre: 'Ventas', tipo: 'ingreso', archivadoEn: null },
      { id: '2', nombre: 'Transferencia', tipo: 'ingreso', archivadoEn: null },
    ];
    expect(esCategoriaDeTransferencia(categorias[1]!)).toBe(true);
    expect(categoriasDe('ingreso', categorias).map((x) => x.nombre)).toEqual(['Ventas']);
  });

  it('el neto de transferencias del día lleva signo', () => {
    expect(textoDeTransferenciasNetas(-20_001)).toBe('− S/ 200.01');
    expect(textoDeTransferenciasNetas(20_001)).toBe('+ S/ 200.01');
    expect(textoDeTransferenciasNetas(0)).toBe('S/ 0.00');
  });
});

describe('formulario de movimiento con productos', () => {
  const cuentas = [{ id: 'caja', esPrincipal: true, archivadoEn: null }] as unknown as CuentaDto[];
  const vacio = formularioInicial('ingreso', HOY, cuentas);
  const etiquetas = filaConCantidad(filaDeCatalogo('a', { id: 'p1', nombre: 'Etiquetas', unidad: 'millar', precioUnitarioMilesimas: 65_000 }), 2000);

  it('sin productos todo sigue igual: el monto es lo tecleado', () => {
    expect(vacio.productos).toEqual([]);
    expect(llevaProductos(vacio)).toBe(false);
    expect(montoDelFormulario({ ...vacio, monto: 4_550 as Centimos })).toBe(4_550);
  });

  it('con productos el monto es la suma y viajan las líneas', () => {
    const f = { ...vacio, productos: [etiquetas] };
    expect(llevaProductos(f)).toBe(true);
    expect(montoDelFormulario(f)).toBe(13_000);
    expect(argumentosDeMovimiento(f)).toMatchObject({ tipo: 'ingreso', montoCentimos: 13_000, lineas: [{ productoId: 'p1', descripcion: 'Etiquetas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000 }] });
    expect(validarMovimiento(f, HOY)).toEqual({});
  });

  it('un producto incompleto no deja guardar y el monto tecleado deja de pedirse', () => {
    const e = validarMovimiento({ ...vacio, productos: [filaLibre('x', 'Diseño')] }, HOY);
    expect(e.productos).toBe('Producto 1: Falta el precio.');
    expect(e.monto).toBeUndefined();
  });

  it('con adelanto los productos no viajan: su suma pasa a ser el total y la lista se vacía', () => {
    const f = conAdelantoActivado({ ...vacio, productos: [etiquetas] });
    expect(f).toMatchObject({ conAdelanto: true, monto: 13_000, productos: [] });
    expect(llevaProductos({ ...vacio, productos: [etiquetas], conAdelanto: true })).toBe(false);
  });

  it('tras guardar, el siguiente formulario sale sin productos', () => {
    expect(siguienteFormulario({ ...vacio, productos: [etiquetas] }).productos).toEqual([]);
  });
});
