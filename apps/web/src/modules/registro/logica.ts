import { formatearSoles, NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA, type CategoriaDto, type Centimos, type CuentaDto, type DeudaDto, type EntradaDe, type MovimientoDto } from '@capaz/shared';

// Lógica pura de las pantallas de `registro`: validación de formularios, armado de argumentos, signo y tono
// de los montos, textos y mensajes. Sin React ni red: se prueba en `logica.spec.ts`.

export type TipoDeMovimiento = MovimientoDto['tipo'];
export type MedioDePago = MovimientoDto['medioDePago'];
export type Tono = 'exito' | 'peligro' | 'neutro' | 'suave';

export const ETIQUETA_DE_MEDIO: Record<MedioDePago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', yape: 'Yape', plin: 'Plin', tarjeta: 'Tarjeta', otro: 'Otro',
};
export const ETIQUETA_DE_TIPO: Record<TipoDeMovimiento, string> = { ingreso: 'Ingreso', egreso: 'Egreso' };
export const ETIQUETA_DE_CUENTA: Record<CuentaDto['tipo'], string> = { caja: 'Caja', banco: 'Banco', billetera: 'Billetera' };

/** Día `AAAA-MM-DD` de un instante en una zona horaria. El servidor decide el día real; esto solo precarga el campo. */
export function diaEnZona(instante: Date, zona = 'America/Lima'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${de('year')}-${de('month')}-${de('day')}`;
}

/** `10/03/2026` a partir de `2026-03-10`, sin pasar por `Date` (un día no tiene zona). */
export function formatearDia(dia: string): string {
  const [a, m, d] = dia.split('-');
  return a && m && d ? `${d}/${m}/${a}` : dia;
}

/** Un movimiento es una pata de transferencia entre cuentas cuando lleva su identificador. */
export const esTransferencia = (m: Pick<MovimientoDto, 'transferenciaId'>): boolean => m.transferenciaId !== null;

/** La categoría del sistema que usan las transferencias: no se ofrece al registrar a mano ni se edita. */
export const esCategoriaDeTransferencia = (c: Pick<CategoriaDto, 'nombre'>): boolean => c.nombre.trim().toLowerCase() === NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA.toLowerCase();

/**
 * Monto con signo y tono: los ingresos suman en verde, los egresos restan en rojo; un anulado no cuenta y una
 * pata de transferencia no es ni ganancia ni gasto (tono suave: el dinero solo cambia de cuenta).
 */
export function montoConSigno(m: Pick<MovimientoDto, 'tipo' | 'montoCentimos' | 'estado'> & { transferenciaId?: string | null }): { texto: string; tono: Tono; anulado: boolean } {
  const anulado = m.estado === 'anulado';
  const signo = m.tipo === 'ingreso' ? '+' : '−';
  const deTransferencia = (m.transferenciaId ?? null) !== null;
  const tono: Tono = anulado ? 'neutro' : deTransferencia ? 'suave' : m.tipo === 'ingreso' ? 'exito' : 'peligro';
  return { texto: `${signo} ${formatearSoles(m.montoCentimos)}`, tono, anulado };
}

/** Lo que identifica a un movimiento en la lista: su descripción o, si no tiene, el contacto. */
export const detalleDeMovimiento = (m: Pick<MovimientoDto, 'descripcion' | 'contactoNombre'>): string => m.descripcion ?? m.contactoNombre ?? '—';

export type FormularioDeMovimiento = {
  tipo: TipoDeMovimiento;
  monto: Centimos | null;
  fecha: string;
  cuentaId: string;
  categoriaId: string;
  contacto: { id: string; nombre: string } | null;
  medioDePago: MedioDePago;
  descripcion: string;
  /** «¿Hubo adelanto?»: el monto pasa a ser el TOTAL, lo que se dejó va a cuenta y el resto queda por cobrar o pagar. */
  conAdelanto: boolean;
  adelanto: Centimos | null;
  /** Hasta cuándo se espera el resto (opcional, solo con adelanto). */
  venceEn: string;
};
export type ErroresDeMovimiento = Partial<Record<'monto' | 'fecha' | 'cuentaId' | 'descripcion' | 'adelanto' | 'contacto' | 'venceEn', string>>;

/** Lo que falta cancelar: el total menos lo que se dejó a cuenta (nunca negativo en pantalla). */
export const faltaCancelar = (f: Pick<FormularioDeMovimiento, 'monto' | 'adelanto'>): number => Math.max(0, (f.monto ?? 0) - (f.adelanto ?? 0));

/** Formulario en blanco: fecha de hoy, la cuenta principal elegida y efectivo. */
export function formularioInicial(tipo: TipoDeMovimiento, hoy: string, cuentas: readonly CuentaDto[]): FormularioDeMovimiento {
  const vivas = cuentas.filter((c) => c.archivadoEn === null);
  const principal = vivas.find((c) => c.esPrincipal) ?? vivas[0];
  return { tipo, monto: null, fecha: hoy, cuentaId: principal?.id ?? '', categoriaId: '', contacto: null, medioDePago: 'efectivo', descripcion: '', conAdelanto: false, adelanto: null, venceEn: '' };
}

/** Tras guardar, la hoja queda lista para el siguiente: se conservan tipo, fecha, cuenta y medio; se vacía lo demás. */
export const siguienteFormulario = (f: FormularioDeMovimiento): FormularioDeMovimiento => ({ ...f, monto: null, categoriaId: '', contacto: null, descripcion: '', conAdelanto: false, adelanto: null, venceEn: '' });

/** Las categorías en uso del tipo del movimiento. */
export const categoriasDe = (tipo: TipoDeMovimiento, categorias: readonly CategoriaDto[]): CategoriaDto[] =>
  categorias.filter((c) => c.tipo === tipo && c.archivadoEn === null && !esCategoriaDeTransferencia(c));

export function validarMovimiento(f: FormularioDeMovimiento, hoy: string): ErroresDeMovimiento {
  const e: ErroresDeMovimiento = {};
  if (f.monto === null) e.monto = 'Escribe el monto.';
  else if (!Number.isSafeInteger(f.monto) || f.monto <= 0) e.monto = 'El monto debe ser mayor que cero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Elige la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (f.descripcion.trim().length > 500) e.descripcion = 'La descripción admite hasta 500 caracteres.';
  if (f.conAdelanto) {
    if (!f.contacto) e.contacto = f.tipo === 'ingreso' ? 'Elige a quién se le vendió: el resto queda por cobrarle.' : 'Elige a quién se le compró: el resto queda por pagarle.';
    if (f.adelanto === null || f.adelanto <= 0) e.adelanto = 'Escribe cuánto dejó a cuenta, por ejemplo 30 o 30.50.';
    else if (f.monto !== null && f.adelanto >= f.monto) e.adelanto = 'El adelanto debe ser menor que el total: si ya pagó todo, registra un ingreso sin adelanto.';
    if (f.venceEn && f.venceEn < f.fecha) e.venceEn = 'El vencimiento no puede ser anterior a la fecha.';
  }
  return e;
}

/** Argumentos de `movimiento_registrar`: solo lo que la persona eligió (sin cuenta, el servidor usa la principal). */
export function argumentosDeMovimiento(f: FormularioDeMovimiento): EntradaDe<'movimiento_registrar'> {
  if (f.monto === null) throw new Error('No se arma un movimiento sin monto.');
  const args: EntradaDe<'movimiento_registrar'> = { tipo: f.tipo, montoCentimos: f.monto, fecha: f.fecha, medioDePago: f.medioDePago };
  if (f.cuentaId) args.cuentaId = f.cuentaId;
  if (f.categoriaId) args.categoriaId = f.categoriaId;
  if (f.contacto) args.contactoId = f.contacto.id;
  const descripcion = f.descripcion.trim();
  if (descripcion) args.descripcion = descripcion;
  return args;
}

/**
 * Argumentos de `deuda_crear_con_adelanto`: un ingreso con adelanto es una venta por cobrar y un egreso con adelanto una compra
 * por pagar; la deuda y el adelanto nacen en un solo gesto. El concepto, si no se escribe, nombra al contacto.
 */
export function argumentosDeAdelanto(f: FormularioDeMovimiento): EntradaDe<'deuda_crear_con_adelanto'> {
  if (f.monto === null || f.adelanto === null || !f.contacto) throw new Error('No se arma una deuda con adelanto sin total, adelanto y contacto.');
  const concepto = f.descripcion.trim() || `${f.tipo === 'ingreso' ? 'Venta a' : 'Compra a'} ${f.contacto.nombre}`;
  const args: EntradaDe<'deuda_crear_con_adelanto'> = {
    tipo: f.tipo === 'ingreso' ? 'por_cobrar' : 'por_pagar',
    contactoId: f.contacto.id,
    concepto: concepto.slice(0, 200),
    totalCentimos: f.monto,
    adelantoCentimos: f.adelanto,
    fecha: f.fecha,
    medioDePago: f.medioDePago,
  };
  if (f.cuentaId) args.cuentaId = f.cuentaId;
  if (f.venceEn) args.venceEn = f.venceEn;
  return args;
}

export type EstadoDeListado = EntradaDe<'movimientos_listar'>['estado'] & string;
export type FiltrosDeMovimientos = { desde: string; hasta: string; tipo: '' | TipoDeMovimiento; cuentaId: string; estado: EstadoDeListado };
export const FILTROS_VACIOS: FiltrosDeMovimientos = { desde: '', hasta: '', tipo: '', cuentaId: '', estado: 'todos' };
export const ETIQUETA_DE_ESTADO_DE_LISTADO: Record<EstadoDeListado, string> = { todos: 'Vigentes y anulados', activos: 'Solo vigentes', anulados: 'Solo anulados' };

/** Argumentos de `movimientos_listar`: los filtros vacíos no viajan. Por defecto se ven también los anulados, marcados. */
export function argumentosDeListado(f: FiltrosDeMovimientos, limite: number, cursor?: string): EntradaDe<'movimientos_listar'> {
  const args: EntradaDe<'movimientos_listar'> = { limite, estado: f.estado };
  if (f.desde) args.desde = f.desde;
  if (f.hasta) args.hasta = f.hasta;
  if (f.tipo) args.tipo = f.tipo;
  if (f.cuentaId) args.cuentaId = f.cuentaId;
  if (cursor) args.cursor = cursor;
  return args;
}

/** Un rango al revés no se consulta: se avisa en el campo. */
export const errorDeRango = (f: Pick<FiltrosDeMovimientos, 'desde' | 'hasta'>): string | undefined =>
  f.desde && f.hasta && f.hasta < f.desde ? 'La fecha final es anterior a la inicial.' : undefined;

/** Al entrar al módulo: si no hay cuentas y la persona puede editar, se preparan los catálogos una vez. */
export const debeIniciar = (cuentas: readonly unknown[] | undefined, puedeEditar: boolean): boolean => puedeEditar && cuentas !== undefined && cuentas.length === 0;

// ---- Deudas (por cobrar y por pagar) ----

export type TipoDeDeuda = DeudaDto['tipo'];
export type EstadoDeDeuda = DeudaDto['estado'];
export type TonoDeEstado = 'neutro' | 'exito' | 'aviso' | 'peligro' | 'info';
export type FiltroDeDeudas = EntradaDe<'deudas_listar'>['estado'] & string;

export const ETIQUETA_DE_ESTADO_DE_DEUDA: Record<EstadoDeDeuda, string> = { pendiente: 'Pendiente', parcial: 'Parcial', pagada: 'Pagada', anulada: 'Anulada' };
export const TONO_DE_ESTADO_DE_DEUDA: Record<EstadoDeDeuda, TonoDeEstado> = { pendiente: 'aviso', parcial: 'info', pagada: 'exito', anulada: 'neutro' };
export const TITULO_DE_DEUDAS: Record<TipoDeDeuda, string> = { por_cobrar: 'Por cobrar', por_pagar: 'Por pagar' };
export const ETIQUETA_DE_FILTRO_DE_DEUDAS: Record<FiltroDeDeudas, string> = {
  abiertas: 'Abiertas', vencidas: 'Vencidas', pagadas: 'Pagadas', anuladas: 'Anuladas', todas: 'Todas',
};

/** Pasos de la barra de estado de una deuda; una deuda anulada no avanza por ellos. */
export const PASOS_DE_DEUDA = ['Pendiente', 'Parcial', 'Pagada'] as const;
export const pasoDeDeuda = (estado: EstadoDeDeuda): number => (estado === 'pendiente' ? 0 : estado === 'parcial' ? 1 : estado === 'pagada' ? 2 : -1);

/** Texto del estado de una deuda; una abierta y vencida lo dice (el rojo solo no basta). */
export const textoDeEstadoDeDeuda = (d: Pick<DeudaDto, 'estado' | 'vencida'>): string =>
  d.vencida ? `${ETIQUETA_DE_ESTADO_DE_DEUDA[d.estado]} · Vencida` : ETIQUETA_DE_ESTADO_DE_DEUDA[d.estado];
export const tonoDeEstadoDeDeuda = (d: Pick<DeudaDto, 'estado' | 'vencida'>): TonoDeEstado => (d.vencida ? 'peligro' : TONO_DE_ESTADO_DE_DEUDA[d.estado]);

/** Una deuda abierta admite abonos, edición y anulación; una pagada o anulada ya no se abona. */
export const estaAbierta = (d: Pick<DeudaDto, 'estado'>): boolean => d.estado === 'pendiente' || d.estado === 'parcial';

export function argumentosDeListadoDeDeudas(tipo: TipoDeDeuda, estado: FiltroDeDeudas, limite: number, cursor?: string): EntradaDe<'deudas_listar'> {
  const args: EntradaDe<'deudas_listar'> = { tipo, estado, limite };
  if (cursor) args.cursor = cursor;
  return args;
}

export type FormularioDeAbono = { monto: Centimos | null; fecha: string; cuentaId: string; medioDePago: MedioDePago; descripcion: string };
export type ErroresDeAbono = Partial<Record<'monto' | 'fecha' | 'descripcion', string>>;

/** Abono en blanco: el saldo precargado, hoy, la cuenta principal y efectivo. */
export function abonoInicial(saldo: Centimos, hoy: string, cuentas: readonly CuentaDto[]): FormularioDeAbono {
  const { cuentaId } = formularioInicial('ingreso', hoy, cuentas);
  return { monto: saldo, fecha: hoy, cuentaId, medioDePago: 'efectivo', descripcion: '' };
}

export function validarAbono(f: FormularioDeAbono, saldo: number, hoy: string): ErroresDeAbono {
  const e: ErroresDeAbono = {};
  if (f.monto === null) e.monto = 'Escribe el monto del abono.';
  else if (!Number.isSafeInteger(f.monto) || f.monto <= 0) e.monto = 'El monto debe ser mayor que cero.';
  else if (f.monto > saldo) e.monto = `El abono no puede superar el saldo (${formatearSoles(saldo as Centimos)}).`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Elige la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (f.descripcion.trim().length > 500) e.descripcion = 'La descripción admite hasta 500 caracteres.';
  return e;
}

export function argumentosDeAbono(id: string, f: FormularioDeAbono): EntradaDe<'deuda_abonar'> {
  if (f.monto === null) throw new Error('No se arma un abono sin monto.');
  const args: EntradaDe<'deuda_abonar'> = { id, montoCentimos: f.monto, fecha: f.fecha, medioDePago: f.medioDePago };
  if (f.cuentaId) args.cuentaId = f.cuentaId;
  const descripcion = f.descripcion.trim();
  if (descripcion) args.descripcion = descripcion;
  return args;
}

export type FormularioDeDeuda = { concepto: string; venceEn: string; notas: string };
export type ErroresDeDeuda = Partial<Record<'concepto' | 'venceEn' | 'notas', string>>;

export const formularioDeDeuda = (d: Pick<DeudaDto, 'concepto' | 'venceEn' | 'notas'>): FormularioDeDeuda => ({ concepto: d.concepto, venceEn: d.venceEn ?? '', notas: d.notas ?? '' });

export function validarDeuda(f: FormularioDeDeuda): ErroresDeDeuda {
  const e: ErroresDeDeuda = {};
  if (!f.concepto.trim()) e.concepto = 'Indica el concepto.';
  else if (f.concepto.trim().length > 200) e.concepto = 'El concepto admite hasta 200 caracteres.';
  if (f.venceEn && !/^\d{4}-\d{2}-\d{2}$/.test(f.venceEn)) e.venceEn = 'Elige una fecha válida.';
  if (f.notas.trim().length > 2000) e.notas = 'Las notas admiten hasta 2000 caracteres.';
  return e;
}

/** Argumentos de `deuda_editar`: solo lo que cambió (vaciar el vencimiento o las notas viaja como `null`). `null` si nada cambió. */
export function argumentosDeEdicionDeDeuda(id: string, f: FormularioDeDeuda, original: Pick<DeudaDto, 'concepto' | 'venceEn' | 'notas'>): EntradaDe<'deuda_editar'> | null {
  const args: EntradaDe<'deuda_editar'> = { id };
  let cambio = false;
  if (f.concepto.trim() !== original.concepto) { args.concepto = f.concepto.trim(); cambio = true; }
  if (f.venceEn !== (original.venceEn ?? '')) { args.venceEn = f.venceEn || null; cambio = true; }
  if (f.notas.trim() !== (original.notas ?? '')) { args.notas = f.notas.trim() || null; cambio = true; }
  return cambio ? args : null;
}

/** El motivo de una anulación es obligatorio y admite hasta 300 caracteres. */
export function validarMotivo(texto: string): string | undefined {
  if (!texto.trim()) return 'Indica el motivo.';
  if (texto.trim().length > 300) return 'El motivo admite hasta 300 caracteres.';
  return undefined;
}

// ---- Cuentas y categorías ----

export type FormularioDeCuenta = { nombre: string; tipo: CuentaDto['tipo']; saldoInicial: Centimos | null };
export type ErroresDeCuenta = Partial<Record<'nombre' | 'saldoInicial', string>>;

export const cuentaEnBlanco = (): FormularioDeCuenta => ({ nombre: '', tipo: 'caja', saldoInicial: null });
export const formularioDeCuenta = (c: CuentaDto): FormularioDeCuenta => ({ nombre: c.nombre, tipo: c.tipo, saldoInicial: c.saldoInicialCentimos as Centimos });

/** Valida un nombre de cuenta o categoría (1 a 80 caracteres). */
export function validarNombre(nombre: string): string | undefined {
  if (!nombre.trim()) return 'El nombre es obligatorio.';
  if (nombre.trim().length > 80) return 'El nombre admite hasta 80 caracteres.';
  return undefined;
}

export function validarCuenta(f: FormularioDeCuenta): ErroresDeCuenta {
  const e: ErroresDeCuenta = {};
  const n = validarNombre(f.nombre);
  if (n) e.nombre = n;
  if (f.saldoInicial !== null && !Number.isSafeInteger(f.saldoInicial)) e.saldoInicial = 'Escribe un saldo válido.';
  return e;
}

export const argumentosDeCuentaNueva = (f: FormularioDeCuenta): EntradaDe<'cuenta_crear'> => ({ nombre: f.nombre.trim(), tipo: f.tipo, saldoInicialCentimos: f.saldoInicial ?? 0 });

/** El saldo inicial no se edita (lo mueven los movimientos): al editar solo viajan nombre y tipo. */
export const argumentosDeCuentaEditada = (id: string, f: FormularioDeCuenta): EntradaDe<'cuenta_editar'> => ({ id, nombre: f.nombre.trim(), tipo: f.tipo });

const MENSAJES: Record<string, string> = {
  modulo_solo_lectura: 'Tu acceso a Finanzas es de solo lectura: no puedes registrar ni cambiar datos.',
  modulo_no_disponible: 'Tu empresa no tiene activo este módulo o no te lo asignaron.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  error_de_red: 'No hay conexión. Revisa tu internet y vuelve a intentarlo.',
  error_interno: 'Algo falló de nuestro lado; no se guardó nada. Vuelve a intentarlo.',
};

/** Mensaje para la persona según el código del rechazo; los de negocio (conflicto, datos inválidos) ya vienen redactados. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'sin_permiso' && mensaje.startsWith('Tu acceso')) return mensaje;
  return MENSAJES[codigo] ?? mensaje;
}

// ---- Nueva deuda a mano (por cobrar o por pagar) ----

export type FormularioDeDeudaNueva = { contacto: { id: string; nombre: string } | null; concepto: string; total: Centimos | null; venceEn: string; notas: string };
export type ErroresDeDeudaNueva = Partial<Record<'contacto' | 'concepto' | 'total' | 'venceEn' | 'notas', string>>;

export const deudaNuevaEnBlanco = (): FormularioDeDeudaNueva => ({ contacto: null, concepto: '', total: null, venceEn: '', notas: '' });

/** El vencimiento no puede ser anterior a hoy (la deuda se anota con la fecha de hoy). */
export function validarDeudaNueva(f: FormularioDeDeudaNueva, hoy: string): ErroresDeDeudaNueva {
  const e: ErroresDeDeudaNueva = {};
  if (!f.contacto) e.contacto = 'Elige el cliente o proveedor.';
  if (!f.concepto.trim()) e.concepto = 'Indica el concepto.';
  else if (f.concepto.trim().length > 200) e.concepto = 'El concepto admite hasta 200 caracteres.';
  if (f.total === null) e.total = 'Escribe el total.';
  else if (!Number.isSafeInteger(f.total) || f.total <= 0) e.total = 'El total debe ser mayor que cero.';
  if (f.venceEn && !/^\d{4}-\d{2}-\d{2}$/.test(f.venceEn)) e.venceEn = 'Elige una fecha válida.';
  else if (f.venceEn && f.venceEn < hoy) e.venceEn = 'El vencimiento no puede ser anterior a hoy.';
  if (f.notas.trim().length > 2000) e.notas = 'Las notas admiten hasta 2000 caracteres.';
  return e;
}

/** Argumentos de `deuda_crear`: lo vacío no viaja. La fecha la fija el servidor (hoy de la empresa). */
export function argumentosDeDeudaNueva(tipo: TipoDeDeuda, f: FormularioDeDeudaNueva): EntradaDe<'deuda_crear'> {
  if (!f.contacto || f.total === null) throw new Error('No se arma una deuda sin contacto ni total.');
  const args: EntradaDe<'deuda_crear'> = { tipo, contactoId: f.contacto.id, concepto: f.concepto.trim(), totalCentimos: f.total };
  if (f.venceEn) args.venceEn = f.venceEn;
  const notas = f.notas.trim();
  if (notas) args.notas = notas;
  return args;
}

/** Título de la hoja de nueva deuda, según el tipo. */
export const TITULO_DE_DEUDA_NUEVA: Record<TipoDeDeuda, string> = { por_cobrar: 'Nueva deuda por cobrar', por_pagar: 'Nueva deuda por pagar' };
export const ETIQUETA_DE_CONTACTO_DE_DEUDA: Record<TipoDeDeuda, string> = { por_cobrar: 'Cliente', por_pagar: 'Proveedor' };

// ---- Transferencia entre cuentas ----

export type FormularioDeTransferencia = { origenId: string; destinoId: string; monto: Centimos | null; fecha: string; nota: string };
export type ErroresDeTransferencia = Partial<Record<'origenId' | 'destinoId' | 'monto' | 'fecha' | 'nota', string>>;

/** Cuentas en uso (no archivadas). */
export const cuentasVivas = (cuentas: readonly CuentaDto[]): CuentaDto[] => cuentas.filter((c) => c.archivadoEn === null);

/** Formulario en blanco: sale de la cuenta principal y llega a la primera otra cuenta en uso. */
export function transferenciaInicial(hoy: string, cuentas: readonly CuentaDto[]): FormularioDeTransferencia {
  const vivas = cuentasVivas(cuentas);
  const origen = vivas.find((c) => c.esPrincipal) ?? vivas[0];
  const destino = vivas.find((c) => c.id !== origen?.id);
  return { origenId: origen?.id ?? '', destinoId: destino?.id ?? '', monto: null, fecha: hoy, nota: '' };
}

/** Las cuentas a las que se puede transferir desde `origenId`: todas las vivas menos la de origen. */
export const cuentasDeDestino = (cuentas: readonly CuentaDto[], origenId: string): CuentaDto[] => cuentasVivas(cuentas).filter((c) => c.id !== origenId);

/** Hace falta al menos dos cuentas en uso para transferir. */
export const puedeTransferir = (cuentas: readonly CuentaDto[]): boolean => cuentasVivas(cuentas).length >= 2;

export function validarTransferencia(f: FormularioDeTransferencia, hoy: string): ErroresDeTransferencia {
  const e: ErroresDeTransferencia = {};
  if (!f.origenId) e.origenId = 'Elige la cuenta de origen.';
  if (!f.destinoId) e.destinoId = 'Elige la cuenta de destino.';
  else if (f.destinoId === f.origenId) e.destinoId = 'El destino debe ser otra cuenta.';
  if (f.monto === null) e.monto = 'Escribe el monto.';
  else if (!Number.isSafeInteger(f.monto) || f.monto <= 0) e.monto = 'El monto debe ser mayor que cero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Elige la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (f.nota.trim().length > 500) e.nota = 'La nota admite hasta 500 caracteres.';
  return e;
}

/** Argumentos de `cuentas_transferir`: la nota vacía no viaja. */
export function argumentosDeTransferencia(f: FormularioDeTransferencia): EntradaDe<'cuentas_transferir'> {
  if (f.monto === null) throw new Error('No se arma una transferencia sin monto.');
  const args: EntradaDe<'cuentas_transferir'> = { origenId: f.origenId, destinoId: f.destinoId, montoCentimos: f.monto, fecha: f.fecha };
  const nota = f.nota.trim();
  if (nota) args.nota = nota;
  return args;
}

/** Tras guardar, la hoja queda lista para otra: se conservan cuentas y fecha; se vacían monto y nota. */
export const siguienteTransferencia = (f: FormularioDeTransferencia): FormularioDeTransferencia => ({ ...f, monto: null, nota: '' });

/** Intercambia origen y destino (el botón «Invertir»). */
export const invertirTransferencia = (f: FormularioDeTransferencia): FormularioDeTransferencia => ({ ...f, origenId: f.destinoId, destinoId: f.origenId });

/** Texto de un monto de transferencia neto del día en la caja: con signo, vacío si no hubo. */
export function textoDeTransferenciasNetas(centimos: number): string {
  if (centimos === 0) return formatearSoles(0 as Centimos);
  return `${centimos > 0 ? '+' : '−'} ${formatearSoles(Math.abs(centimos) as Centimos)}`;
}
