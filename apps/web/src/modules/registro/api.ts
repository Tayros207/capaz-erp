import type { EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';
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

export const anularMovimiento = (id: string, motivo: string) =>
  llamarConfirmando('movimiento_anular', { id, motivo }, { titulo: 'Anular movimiento', textoConfirmar: 'Anular', peligroso: true });
export const crearCuenta = (args: EntradaDe<'cuenta_crear'>) => llamar('cuenta_crear', args);
export const editarCuenta = (args: EntradaDe<'cuenta_editar'>) => llamar('cuenta_editar', args);
export const archivarCuenta = (id: string) => llamar('cuenta_archivar', { id });
export const marcarCuentaPrincipal = (id: string) => llamar('cuenta_marcar_principal', { id });
export const crearCategoria = (args: EntradaDe<'categoria_crear'>) => llamar('categoria_crear', args);
export const editarCategoria = (id: string, nombre: string) => llamar('categoria_editar', { id, nombre });
export const archivarCategoria = (id: string) => llamar('categoria_archivar', { id });
export const listarDeudas = (args: EntradaDe<'deudas_listar'>) => llamar('deudas_listar', args);
export const crearDeuda = (args: EntradaDe<'deuda_crear'>) => llamar('deuda_crear', args);
export const verDeuda = (id: string) => llamar('deuda_ver', { id });
export const editarDeuda = (args: EntradaDe<'deuda_editar'>) => llamar('deuda_editar', args);
export const abonarDeuda = (args: EntradaDe<'deuda_abonar'>) => llamar('deuda_abonar', args);
export const anularDeuda = (id: string, motivo: string) =>
  llamarConfirmando('deuda_anular', { id, motivo }, { titulo: 'Anular deuda', textoConfirmar: 'Anular', peligroso: true });
export const verCajaDelDia = (fecha: string) => llamar('caja_del_dia', { fecha });
export const verResumen = (desde: string, hasta: string) => llamar('registro_resumen', { desde, hasta });
