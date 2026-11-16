import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { cancelarCompra, enviarCompra } from './api.ts';
import { CLAVE_COMPRAS } from './claves.ts';
import { mensajeDeRechazo } from './logica.ts';

/** Qué puede hacer esta persona en Compras: escribir exige acceso completo al módulo y el permiso. */
export function usePermisosDeCompras(): { editar: boolean; cancelar: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'compras');
  return { editar: escribe && puede(yo, 'compras:editar'), cancelar: escribe && puede(yo, 'compras:cancelar') };
}

export const refrescarCompras = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_COMPRAS });

/** Envía el borrador (recibe su número), avisa y refresca. Devuelve si se aplicó. */
export async function enviar(id: string): Promise<boolean> {
  const r = await enviarCompra(id);
  if (r.ok && 'datos' in r) {
    notificar(`Orden enviada: ${r.datos.codigo}.`, 'exito');
    await refrescarCompras();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}

/** Cancela en dos pasos (la persona confirma el resumen del servidor). Devuelve si se canceló. */
export async function cancelar(id: string, motivo: string): Promise<boolean> {
  const r = await cancelarCompra(id, motivo);
  if ('cancelada' in r) return false;
  if (r.ok && 'datos' in r) {
    notificar('Orden de compra cancelada.', 'exito');
    await refrescarCompras();
    return true;
  }
  if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  return false;
}
