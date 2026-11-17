import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Transferencias entre sucursales, inventario físico (conteos) y kardex valorizado (0026).

export const POR_PAGINA_DE_OPERACIONES = 25;

export const crearTransferencia = (args: EntradaDe<'transferencia_crear'>) => llamar('transferencia_crear', args);
export const listarTransferencias = (args: EntradaDe<'transferencias_listar'>) => llamar('transferencias_listar', args);

export const abrirConteo = (args: EntradaDe<'conteo_abrir'>) => llamar('conteo_abrir', args);
export const verConteo = (id: string) => llamar('conteo_ver', { id });
export const listarConteos = (args: EntradaDe<'conteos_listar'>) => llamar('conteos_listar', args);
export const registrarConteo = (args: EntradaDe<'conteo_registrar'>) => llamar('conteo_registrar', args);
export const anularConteo = (args: EntradaDe<'conteo_anular'>) => llamar('conteo_anular', args);

/** Crítica: el servidor resume cuántas diferencias va a ajustar y la persona confirma. */
export const cerrarConteo = (id: string) => llamarConfirmando('conteo_cerrar', { id }, { titulo: 'Cerrar inventario físico', textoConfirmar: 'Cerrar y ajustar' });

export const verKardex = (articuloId: string, sucursalId?: string) => llamar('existencias_kardex', { articuloId, ...(sucursalId && { sucursalId }) });
