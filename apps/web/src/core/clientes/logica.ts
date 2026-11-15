import type { ClienteDto, EntradaDe } from '@capaz/shared';

// Lógica pura de las pantallas de Clientes: el formulario, su validación y los argumentos de las herramientas.

export type TipoDeCliente = 'cliente' | 'proveedor' | 'ambos';
export type ClaseDeCliente = 'persona' | 'empresa';
export type TipoDeDocumento = '' | 'dni' | 'ruc' | 'ce' | 'pasaporte' | 'otro';

export type FormularioDeCliente = {
  tipo: TipoDeCliente;
  clase: ClaseDeCliente;
  nombre: string;
  documentoTipo: TipoDeDocumento;
  documentoNumero: string;
  telefono: string;
  correo: string;
  direccion: string;
  notas: string;
};
export type ErroresDeCliente = Partial<Record<keyof FormularioDeCliente, string>>;

export const ETIQUETA_DE_TIPO: Record<TipoDeCliente, string> = { cliente: 'Cliente', proveedor: 'Proveedor', ambos: 'Cliente y proveedor' };
export const ETIQUETA_DE_CLASE: Record<ClaseDeCliente, string> = { persona: 'Persona', empresa: 'Empresa' };
export const ETIQUETA_DE_DOCUMENTO: Record<Exclude<TipoDeDocumento, ''>, string> = {
  dni: 'DNI',
  ruc: 'RUC',
  ce: 'Carné de extranjería',
  pasaporte: 'Pasaporte',
  otro: 'Otro',
};

export const FORMULARIO_VACIO: FormularioDeCliente = {
  tipo: 'cliente',
  clase: 'persona',
  nombre: '',
  documentoTipo: '',
  documentoNumero: '',
  telefono: '',
  correo: '',
  direccion: '',
  notas: '',
};

export function formularioDesde(c: ClienteDto): FormularioDeCliente {
  return {
    tipo: c.tipo,
    clase: c.clase,
    nombre: c.nombre,
    documentoTipo: c.documentoTipo ?? '',
    documentoNumero: c.documentoNumero ?? '',
    telefono: c.telefono ?? '',
    correo: c.correo ?? '',
    direccion: c.direccion ?? '',
    notas: c.notas ?? '',
  };
}

/** Un RUC es de una empresa; cualquier otro documento, de una persona. */
export function claseSugerida(documentoTipo: TipoDeDocumento, actual: ClaseDeCliente): ClaseDeCliente {
  if (documentoTipo === 'ruc') return 'empresa';
  return actual;
}

const SOLO_DIGITOS = /^\d+$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Avisos en pantalla antes de enviar; el servidor vuelve a validar y manda. Vacío si todo está bien. */
export function validarCliente(f: FormularioDeCliente): ErroresDeCliente {
  const e: ErroresDeCliente = {};
  if (!f.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  const numero = f.documentoNumero.trim();
  if (numero && !f.documentoTipo) e.documentoTipo = 'Elige el tipo de documento.';
  if (f.documentoTipo === 'dni' && numero && !(SOLO_DIGITOS.test(numero) && numero.length === 8)) e.documentoNumero = 'El DNI tiene 8 dígitos.';
  if (f.documentoTipo === 'ruc' && numero && !(SOLO_DIGITOS.test(numero) && numero.length === 11)) e.documentoNumero = 'El RUC tiene 11 dígitos.';
  if (f.documentoTipo && !numero) e.documentoNumero = 'Escribe el número de documento.';
  if (f.correo.trim() && !CORREO.test(f.correo.trim())) e.correo = 'Escribe un correo válido.';
  return e;
}

const vacioANulo = (t: string): string | null => (t.trim() === '' ? null : t.trim());

/** Argumentos de `clientes_crear`: lo vacío se omite. */
export function argumentosDeCreacion(f: FormularioDeCliente): EntradaDe<'clientes_crear'> {
  const args: EntradaDe<'clientes_crear'> = { tipo: f.tipo, clase: f.clase, nombre: f.nombre.trim() };
  if (f.documentoTipo && f.documentoNumero.trim()) {
    args.documentoTipo = f.documentoTipo;
    args.documentoNumero = f.documentoNumero.trim();
  }
  const opcionales = ['telefono', 'correo', 'direccion', 'notas'] as const;
  for (const campo of opcionales) {
    const v = vacioANulo(f[campo]);
    if (v !== null) args[campo] = v;
  }
  return args;
}

/** Argumentos de `clientes_editar`: solo lo que cambió (`null` borra). Nulo si nada cambió. */
export function argumentosDeEdicion(original: ClienteDto, f: FormularioDeCliente): EntradaDe<'clientes_editar'> | null {
  const antes = formularioDesde(original);
  const args: EntradaDe<'clientes_editar'> = { id: original.id };
  let cambio = false;
  if (f.tipo !== antes.tipo) {
    args.tipo = f.tipo;
    cambio = true;
  }
  if (f.clase !== antes.clase) {
    args.clase = f.clase;
    cambio = true;
  }
  if (f.nombre.trim() !== antes.nombre) {
    args.nombre = f.nombre.trim();
    cambio = true;
  }
  if (f.documentoTipo !== antes.documentoTipo || f.documentoNumero.trim() !== antes.documentoNumero) {
    args.documentoTipo = f.documentoTipo === '' || !f.documentoNumero.trim() ? null : f.documentoTipo;
    args.documentoNumero = vacioANulo(f.documentoNumero);
    cambio = true;
  }
  for (const campo of ['telefono', 'correo', 'direccion', 'notas'] as const) {
    if (f[campo].trim() !== antes[campo]) {
      args[campo] = vacioANulo(f[campo]);
      cambio = true;
    }
  }
  return cambio ? args : null;
}

export function textoDeDocumento(c: Pick<ClienteDto, 'documentoTipo' | 'documentoNumero'>): string {
  if (!c.documentoTipo || !c.documentoNumero) return '—';
  return `${ETIQUETA_DE_DOCUMENTO[c.documentoTipo]} ${c.documentoNumero}`;
}

/** Mensaje en español para el campo o el aviso general según el código de rechazo. */
export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'conflicto') return mensaje || 'Ya existe un cliente con esos datos.';
  if (codigo === 'sin_permiso') return 'No tienes permiso para modificar clientes.';
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  return mensaje;
}
