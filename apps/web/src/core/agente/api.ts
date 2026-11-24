import {
  conversacionBorradaSchema, conversacionConMensajesSchema, conversacionDelAgenteSchema, estadoDelAgenteSchema, listaDeConversacionesSchema,
} from '@capaz/shared';
import { pedir } from '../../shared/api/cliente.ts';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Llamadas del panel del asistente al servidor. El turno en sí viaja por SSE (`transporte-sse.ts`); aquí está todo lo demás.

export const CLAVE_AGENTE = ['agente'] as const;
export const CLAVE_ESTADO_DEL_AGENTE = [...CLAVE_AGENTE, 'estado'] as const;
export const CLAVE_CONVERSACIONES = [...CLAVE_AGENTE, 'conversaciones'] as const;
export const CLAVE_CONFIGURACION_DEL_AGENTE = [...CLAVE_AGENTE, 'configuracion'] as const;

const BASE = '/api/v1/agente';
const ruta = (id: string, accion = '') => `${BASE}/conversaciones/${encodeURIComponent(id)}${accion}`;

export const estadoDelAgente = () => pedir('GET', `${BASE}/estado`, estadoDelAgenteSchema);

export const listarConversaciones = (antesDe?: string) =>
  pedir('GET', `${BASE}/conversaciones${antesDe ? `?antesDe=${encodeURIComponent(antesDe)}` : ''}`, listaDeConversacionesSchema);

export const verConversacion = (id: string) => pedir('GET', ruta(id), conversacionConMensajesSchema);
export const renombrarConversacion = (id: string, titulo: string) => pedir('POST', ruta(id, '/renombrar'), conversacionDelAgenteSchema, { titulo });
export const marcarFavorita = (id: string, favorita: boolean) => pedir('POST', ruta(id, '/favorita'), conversacionDelAgenteSchema, { favorita });
export const borrarConversacion = (id: string) => pedir('POST', ruta(id, '/borrar'), conversacionBorradaSchema);

/** El modelo elegido, el gasto del mes y el catálogo con precios. Pasa por la puerta de herramientas, como todo lo del negocio. */
export const verConfiguracionDelAgente = () => llamar('agente_configuracion_ver', {});

/** Cambiar el modelo es una acción crítica: pide confirmación en dos pasos con el resumen que redacta el servidor. */
export const cambiarModelo = (modelo: string | null) =>
  llamarConfirmando('agente_configurar', { modelo }, { titulo: 'Cambiar el modelo del asistente', textoConfirmar: 'Cambiar' });

export const CLAVE_ACCIONES_DEL_AGENTE = [...CLAVE_AGENTE, 'acciones'] as const;
export const CLAVE_LECCIONES_DEL_AGENTE = [...CLAVE_AGENTE, 'lecciones'] as const;

/** Los frenos y el tope por operación del asistente. Es crítica: el servidor redacta el resumen y la persona confirma. */
export const cambiarControl = (cambios: { escrituraDirecta?: boolean; dineroDirecto?: boolean; topePorOperacionCentimos?: number | null }) =>
  llamarConfirmando('agente_configurar', cambios, { titulo: 'Cambiar el control del asistente', textoConfirmar: 'Cambiar' });

/** Lo que hizo el asistente (su huella). Pide el permiso de auditoría. */
export const listarAccionesDelAgente = (cursor?: string) => llamar('agente_acciones_listar', { limite: 25, ...(cursor ? { cursor } : {}) });

/** Lo que aprendió: las lecciones propias y las de la empresa. */
export const listarLeccionesDelAgente = () => llamar('memoria_listar', { limite: 100 });
export const aprobarLeccion = (id: string, alcance?: 'persona' | 'empresa') => llamar('memoria_aprobar', { id, ...(alcance ? { alcance } : {}) });
export const archivarLeccion = (id: string) => llamar('memoria_archivar', { id });
