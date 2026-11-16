import { formatearSoles, type CategoriaDto, type Centimos, type CuentaDto, type EntradaDe, type MovimientoDto } from '@capaz/shared';

// Lógica pura de las pantallas de `registro`: validación de formularios, armado de argumentos, signo y tono
// de los montos, textos y mensajes. Sin React ni red: se prueba en `logica.spec.ts`.

export type TipoDeMovimiento = MovimientoDto['tipo'];
export type MedioDePago = MovimientoDto['medioDePago'];
export type Tono = 'exito' | 'peligro' | 'neutro';

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

/** Monto con signo y tono: los ingresos suman en verde, los egresos restan en rojo; un anulado no cuenta. */
export function montoConSigno(m: Pick<MovimientoDto, 'tipo' | 'montoCentimos' | 'estado'>): { texto: string; tono: Tono; anulado: boolean } {
  const anulado = m.estado === 'anulado';
  const signo = m.tipo === 'ingreso' ? '+' : '−';
  return { texto: `${signo} ${formatearSoles(m.montoCentimos)}`, tono: anulado ? 'neutro' : m.tipo === 'ingreso' ? 'exito' : 'peligro', anulado };
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
};
export type ErroresDeMovimiento = Partial<Record<'monto' | 'fecha' | 'cuentaId' | 'descripcion', string>>;

/** Formulario en blanco: fecha de hoy, la cuenta principal elegida y efectivo. */
export function formularioInicial(tipo: TipoDeMovimiento, hoy: string, cuentas: readonly CuentaDto[]): FormularioDeMovimiento {
  const vivas = cuentas.filter((c) => c.archivadoEn === null);
  const principal = vivas.find((c) => c.esPrincipal) ?? vivas[0];
  return { tipo, monto: null, fecha: hoy, cuentaId: principal?.id ?? '', categoriaId: '', contacto: null, medioDePago: 'efectivo', descripcion: '' };
}

/** Tras guardar, la hoja queda lista para el siguiente: se conservan tipo, fecha, cuenta y medio; se vacía lo demás. */
export const siguienteFormulario = (f: FormularioDeMovimiento): FormularioDeMovimiento => ({ ...f, monto: null, categoriaId: '', contacto: null, descripcion: '' });

/** Las categorías en uso del tipo del movimiento. */
export const categoriasDe = (tipo: TipoDeMovimiento, categorias: readonly CategoriaDto[]): CategoriaDto[] =>
  categorias.filter((c) => c.tipo === tipo && c.archivadoEn === null);

export function validarMovimiento(f: FormularioDeMovimiento, hoy: string): ErroresDeMovimiento {
  const e: ErroresDeMovimiento = {};
  if (f.monto === null) e.monto = 'Escribe el monto.';
  else if (!Number.isSafeInteger(f.monto) || f.monto <= 0) e.monto = 'El monto debe ser mayor que cero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) e.fecha = 'Elige la fecha.';
  else if (f.fecha > hoy) e.fecha = 'La fecha no puede ser futura.';
  if (f.descripcion.trim().length > 500) e.descripcion = 'La descripción admite hasta 500 caracteres.';
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

export type FiltrosDeMovimientos = { desde: string; hasta: string; tipo: '' | TipoDeMovimiento; cuentaId: string };
export const FILTROS_VACIOS: FiltrosDeMovimientos = { desde: '', hasta: '', tipo: '', cuentaId: '' };

/** Argumentos de `movimientos_listar`: los filtros vacíos no viajan. Se ven también los anulados, marcados. */
export function argumentosDeListado(f: FiltrosDeMovimientos, limite: number, cursor?: string): EntradaDe<'movimientos_listar'> {
  const args: EntradaDe<'movimientos_listar'> = { limite, estado: 'todos' };
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
