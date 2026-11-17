import type { EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';

// Llamadas de la pantalla de dictado. Todo va por nombre de herramienta: `core` no importa de `modules`.

export const CLAVE_CAPTURA = ['captura'] as const;

export const proponerCaptura = (args: EntradaDe<'captura_proponer'>) => llamar('captura_proponer', args);
export const medirDictados = (desde: string, hasta: string) => llamar('borradores_metricas', { desde, hasta, origen: 'voz' });
export const listarCuentas = () => llamar('cuentas_listar', { incluirArchivadas: false });
export const listarCategorias = () => llamar('categorias_listar', { incluirArchivadas: false });
export const verCliente = (id: string) => llamar('clientes_ver', { id });
export const crearCliente = (nombre: string) => llamar('clientes_crear', { nombre });
export const verDeuda = (id: string) => llamar('deuda_ver', { id });

export async function buscarContactos(texto: string): Promise<Opcion[]> {
  const r = datosOError(await llamar('clientes_buscar', { texto, limite: 8 }));
  return r.items.map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.documentoNumero ?? c.telefono ?? undefined }));
}
