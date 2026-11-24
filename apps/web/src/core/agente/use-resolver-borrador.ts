import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { notificar } from '../../shared/ui/notificar.ts';
import { CLAVE_BANDEJA } from '../bandeja/claves.ts';
import { CLAVE_CAPTURA } from '../captura/api.ts';
import { avisoAlAprobar } from '../captura/logica.ts';
import type { AccionDeHilo, ElementoDeHilo, Resolucion } from './logica-hilo.ts';

/** Qué hacer cuando la persona resuelve una tarjeta: refrescar la bandeja y avisar según lo que decidió. */
export function useResolverBorrador(hilo: readonly ElementoDeHilo[], despachar: (accion: AccionDeHilo) => void) {
  const cliente = useQueryClient();
  return useCallback((borradorId: string, resolucion: Resolucion) => {
    const elemento = hilo.find((e) => e.tipo === 'borrador' && e.propuesta.id === borradorId);
    despachar({ tipo: 'borrador_resuelto', borradorId, resolucion });
    void cliente.invalidateQueries({ queryKey: CLAVE_BANDEJA });
    void cliente.invalidateQueries({ queryKey: [...CLAVE_CAPTURA, 'metricas'] });
    if (resolucion === 'despues') notificar('Queda en la bandeja', 'info');
    if (resolucion !== 'aprobado') return;
    const aviso = avisoAlAprobar(elemento?.tipo === 'borrador' ? elemento.propuesta.herramienta : undefined);
    notificar(aviso.texto, 'exito');
    void cliente.invalidateQueries({ queryKey: aviso.clave });
  }, [cliente, hilo, despachar]);
}

