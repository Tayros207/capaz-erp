import { FAMILIAS, FAMILIAS_CLASICAS, NOMBRE_DE_FAMILIA, type Familia, type ModuloDeYo, type Yo } from '@capaz/shared';

// Función pura que convierte `yo` en la estructura del menú: núcleo, familias y ajustes.
// La barra lateral, la barra inferior y las tarjetas de /inicio solo dibujan lo que sale de aquí.

/** Cómo se ve y qué permite un módulo. */
export type EstadoDeItem = 'entra' | 'prueba' | 'solo_lectura' | 'bloqueado' | 'proximamente';

export type AccionDeItem = { tipo: 'solicitar'; codigo: string };

export type ItemDeMenu = {
  clave: string;
  nombre: string;
  /** Destino al entrar; nulo si el item no se puede abrir. */
  ruta: string | null;
  icono: string;
  acento: string;
  estado: EstadoDeItem;
  /** Texto corto del estado («Prueba · 5 días», «Solo lectura», «Próximamente»…). Vacío si entra normal. */
  etiqueta: string;
  /** Explicación del bloqueo o de la limitación, para mostrar junto al item. */
  nota: string;
  accion: AccionDeItem | null;
  descripcion: string;
};

export type FamiliaDeMenu = { familia: Familia; nombre: string; items: ItemDeMenu[] };

export type MenuDeYo = { nucleo: ItemDeMenu[]; familias: FamiliaDeMenu[]; ajustes: ItemDeMenu[] };

export const RUTA_DE_MODULO = (codigo: string) => `/m/${codigo}`;

const fijo = (clave: string, nombre: string, ruta: string, icono: string, descripcion: string): ItemDeMenu => ({
  clave, nombre, ruta, icono, acento: 'esmeralda', estado: 'entra', etiqueta: '', nota: '', accion: null, descripcion,
});

export const NUCLEO: readonly ItemDeMenu[] = [
  fijo('inicio', 'Inicio', '/inicio', 'inicio', 'Resumen de tu empresa'),
  fijo('bandeja', 'Bandeja', '/bandeja', 'bandeja', 'Lo que espera tu aprobación'),
  fijo('clientes', 'Clientes', '/clientes', 'clientes', 'Tus clientes y contactos'),
  fijo('productos', 'Productos', '/productos', 'productos', 'Lo que vendes'),
];

export const AJUSTES: readonly ItemDeMenu[] = [
  fijo('ajustes-empresa', 'Empresa', '/ajustes/empresa', 'empresa', 'Datos y zona horaria'),
  fijo('ajustes-usuarios', 'Usuarios', '/ajustes/usuarios', 'usuario', 'Personas y accesos'),
  fijo('ajustes-sucursales', 'Sucursales', '/ajustes/sucursales', 'sucursales', 'Locales de la empresa'),
  fijo('ajustes-conecta', 'Conecta', '/ajustes/conecta', 'conecta', 'Conexiones con otros sistemas'),
  fijo('ajustes-automatizaciones', 'Automatizaciones', '/ajustes/automatizaciones', 'automatizaciones', 'Reglas que trabajan solas'),
  fijo('ajustes-historial', 'Historial', '/ajustes/historial', 'historial', 'Quién hizo qué y cuándo'),
];

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Estado, etiqueta, nota y acción de un módulo según `yo`. Orden de prioridad: construcción, luego motivo de acceso. */
export function itemDeModulo(m: ModuloDeYo): ItemDeMenu {
  const base = {
    clave: `modulo-${m.codigo}`, nombre: m.nombre, icono: m.icono || m.codigo, acento: m.acento, descripcion: m.descripcion,
  };
  const ruta = RUTA_DE_MODULO(m.codigo);
  if (m.enConstruccion) {
    return { ...base, ruta: null, estado: 'proximamente', etiqueta: 'Próximamente', nota: 'Este módulo aún está en construcción.', accion: null };
  }
  const a = m.acceso;
  switch (a.motivo) {
    case 'activo':
      return { ...base, ruta, estado: 'entra', etiqueta: '', nota: '', accion: null };
    case 'prueba': {
      const d = a.diasDePrueba;
      const etiqueta = d === null ? 'Prueba' : `Prueba · ${d} ${plural(d, 'día', 'días')}`;
      return { ...base, ruta, estado: 'prueba', etiqueta, nota: '', accion: null };
    }
    case 'baja_solo_lectura':
      return { ...base, ruta, estado: 'solo_lectura', etiqueta: 'Solo lectura', nota: 'El módulo está dado de baja: puedes consultar, no cambiar.', accion: null };
    case 'suspendido':
      return { ...base, ruta, estado: 'solo_lectura', etiqueta: 'Suspendido', nota: 'El módulo está suspendido: puedes consultar, no cambiar.', accion: null };
    case 'no_contratado':
      return { ...base, ruta: null, estado: 'bloqueado', etiqueta: 'No contratado', nota: 'Tu empresa aún no tiene este módulo.', accion: { tipo: 'solicitar', codigo: m.codigo } };
    case 'sin_asignar':
      return { ...base, ruta: null, estado: 'bloqueado', etiqueta: 'Sin acceso', nota: 'Pide acceso a tu administrador.', accion: null };
  }
}

/** ¿Este item se puede abrir? */
/** «1», «12», «99+»: lo que dice la insignia de pendientes; vacío si no hay ninguno. */
export function textoDeInsignia(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

export const puedeAbrirse = (i: ItemDeMenu) => i.ruta !== null;

export function menuDesdeYo(yo: Yo): MenuDeYo {
  const porFamilia = new Map<Familia, ModuloDeYo[]>();
  for (const m of yo.modulos) {
    if (!m.acceso.visible) continue;
    porFamilia.set(m.familia, [...(porFamilia.get(m.familia) ?? []), m]);
  }
  const clasicas: readonly Familia[] = FAMILIAS_CLASICAS;
  const familias: FamiliaDeMenu[] = [];
  for (const familia of FAMILIAS) {
    const modulos = porFamilia.get(familia) ?? [];
    if (modulos.length === 0 && !clasicas.includes(familia)) continue;
    const items = [...modulos].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')).map(itemDeModulo);
    familias.push({ familia, nombre: NOMBRE_DE_FAMILIA[familia], items });
  }
  return { nucleo: [...NUCLEO], familias, ajustes: [...AJUSTES] };
}

/** Los cuatro destinos de la barra inferior móvil (el resto va en «Más»). */
export const DESTINOS_INFERIORES = ['inicio', 'bandeja', 'clientes', 'productos'] as const;

/**
 * Guarda de módulo: si la ruta es `/m/<codigo>/…` y esa persona no puede entrar, devuelve el aviso
 * para mostrar al redirigir a /inicio; si puede entrar (o no es ruta de módulo), nulo.
 */
export function avisoDeAccesoDenegado(yo: Yo, ruta: string): string | null {
  const coincide = /^\/m\/([^/]+)/.exec(ruta);
  if (!coincide) return null;
  const m = yo.modulos.find((x) => x.codigo === coincide[1]);
  if (!m) return 'Ese módulo no existe en tu empresa.';
  const item = itemDeModulo(m);
  if (puedeAbrirse(item)) return null;
  return item.estado === 'proximamente' ? `${m.nombre}: próximamente.` : `${m.nombre}: ${item.nota}`;
}
