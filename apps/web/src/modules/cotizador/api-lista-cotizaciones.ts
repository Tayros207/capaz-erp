import { llamar } from '../../shared/api/herramientas.ts';

// Llamadas de la lista de cotizaciones y de la ficha del cliente (carril cot-p5). Van aparte de `api-cotizaciones.ts`.

/** «Volver a cotizar»: crea un borrador igual a la cotización y devuelve la nueva. */
export const volverACotizar = (id: string) => llamar('cotizacion_duplicar', { id });

/** Las últimas cotizaciones de un cliente, las más recientes primero. */
export const cotizacionesDeCliente = (clienteId: string, limite = 5) => llamar('cotizaciones_listar', { clienteId, estado: 'todas', limite });
