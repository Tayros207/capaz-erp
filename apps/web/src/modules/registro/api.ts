import type { EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';

// Llamadas del módulo: todo pasa por herramientas tipadas (`POST /api/v1/herramientas/:nombre`).

export const POR_PAGINA = 25;

export const iniciarRegistro = () => llamar('registro_iniciar', {});
export const listarCuentas = (incluirArchivadas = false) => llamar('cuentas_listar', { incluirArchivadas });
export const listarCategorias = (incluirArchivadas = false) => llamar('categorias_listar', { incluirArchivadas });
export const registrarMovimiento = (args: EntradaDe<'movimiento_registrar'>) => llamar('movimiento_registrar', args);
export const verMovimiento = (id: string) => llamar('movimiento_ver', { id });
export const listarMovimientos = (args: EntradaDe<'movimientos_listar'>) => llamar('movimientos_listar', args);

/** Contactos (clientes y proveedores del núcleo) para el selector de la hoja de alta. */
export async function buscarContactos(texto: string): Promise<Opcion[]> {
  const r = datosOError(await llamar('clientes_buscar', { texto, limite: 8 }));
  return r.items.map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.documentoNumero ?? c.telefono ?? undefined }));
}
