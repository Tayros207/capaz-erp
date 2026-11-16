import { APELLIDOS, NOMBRES, SUFIJOS_EMPRESA, dniFicticio, nombreDePersona, rucFicticio, telefonoFicticio, type Azar } from './azar.ts';
import type { Sector } from './sectores.ts';

// Generadores de productos, clientes y proveedores de cada sector, listos para el CSV de importación
// (`importar_csv_aplicar`). Los nombres no se repiten dentro de una empresa: el importador omite repetidos.

export type ProductoDemo = { codigo: string; nombre: string; tipo: 'producto' | 'servicio'; unidad: string; precioSoles: number };

export function generarProductos(sec: Sector, az: Azar): ProductoDemo[] {
  const porGrupo = sec.grupos.map((g) => {
    const combos = g.bases.flatMap((b) => g.variantes.map((v) => `${b} ${v}`));
    return { g, nombres: az.mezclar(combos), usados: 0 };
  });
  const salida: ProductoDemo[] = [];
  const vistos = new Set<string>();
  let hay = true;
  while (salida.length < sec.objetivoProductos && hay) {
    hay = false;
    for (const p of porGrupo) {
      const nombre = p.nombres[p.usados];
      if (!nombre || salida.length >= sec.objetivoProductos) continue;
      p.usados++;
      hay = true;
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      const [min, max] = p.g.precio;
      const precio = Math.round((min + az.next() * (max - min)) * 10) / 10;
      salida.push({ codigo: `${p.g.prefijo}-${String(p.usados).padStart(3, '0')}`, nombre, tipo: p.g.tipo ?? 'producto', unidad: p.g.unidad, precioSoles: Math.max(precio, 0.5) });
    }
  }
  return salida;
}

/** El CSV no admite comillas dentro de un campo: las pulgadas se escriben «pulg». */
const celda = (v: string): string => v.replace(/"/g, ' pulg').replace(/[;\n\r]/g, ' ');

export function csvDeProductos(ps: ProductoDemo[]): string {
  const filas = ps.map((p) => [p.codigo, p.nombre, p.tipo, p.unidad, p.precioSoles.toFixed(2), 'si', `${p.nombre} (${p.codigo})`].map(celda).join(';'));
  return ['codigo;nombre;tipo;unidad;precio;afecto a igv;descripcion', ...filas].join('\n');
}

const DISTRITOS = ['Lima Cercado', 'Miraflores', 'San Isidro', 'Surco', 'Ate', 'La Victoria', 'San Juan de Lurigancho', 'Comas', 'Callao', 'Chorrillos', 'Barranco', 'Los Olivos', 'San Borja', 'Villa El Salvador'];
const CALLES = ['Av. Arequipa', 'Jr. Cusco', 'Av. Brasil', 'Calle Los Pinos', 'Av. Universitaria', 'Jr. Huallaga', 'Av. Tomás Marsano', 'Calle Las Begonias', 'Av. Angamos', 'Jr. Puno'];
const slug = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function csvDeContactos(sec: Sector, az: Azar): { csv: string; total: number } {
  const filas: string[] = [];
  const nombres = new Set<string>();
  const direccion = (): string => `${az.pick(CALLES)} ${az.int(100, 2900)}, ${az.pick(DISTRITOS)}`;
  const fila = (tipo: string, clase: string, nombre: string, docTipo: string, doc: string, correo: string, notas: string): void => {
    nombres.add(nombre);
    filas.push([tipo, clase, nombre, docTipo, doc, telefonoFicticio(az), correo, direccion(), notas].map(celda).join(';'));
  };
  for (let i = 0; i < sec.clientes; i++) {
    const ambos = az.chance(0.08);
    const tipo = ambos ? 'ambos' : 'cliente';
    if (az.chance(0.3)) {
      const nombre = nombreDePersona(az);
      if (nombres.has(nombre)) continue;
      fila(tipo, 'persona', nombre, 'dni', dniFicticio(az), `${slug(nombre).slice(0, 18)}@correo.pe`, az.chance(0.2) ? 'Cliente frecuente' : '');
    } else {
      const nombre = `${az.pick(sec.prefijos)} ${az.pick(sec.giros)} ${az.pick(SUFIJOS_EMPRESA)}`;
      if (nombres.has(nombre)) continue;
      fila(tipo, 'empresa', nombre, 'ruc', rucFicticio(az), `compras@${slug(nombre).slice(0, 16)}.pe`, az.chance(0.25) ? 'Paga a 15 días' : '');
    }
  }
  for (let i = 0; i < sec.proveedores; i++) {
    const base = sec.proveedoresBase[i % sec.proveedoresBase.length]!;
    const nombre = i < sec.proveedoresBase.length ? `${base} ${az.pick(SUFIJOS_EMPRESA)}` : `${base} ${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[i % APELLIDOS.length]}`;
    if (nombres.has(nombre)) continue;
    fila('proveedor', 'empresa', nombre, 'ruc', rucFicticio(az), `ventas@${slug(base).slice(0, 16)}.pe`, 'Proveedor habitual');
  }
  const cabecera = 'tipo;clase;nombre;tipo de documento;numero de documento;telefono;correo;direccion;notas';
  return { csv: [cabecera, ...filas].join('\n'), total: filas.length };
}
