import type { Ayuda } from '@capaz/shared';

// La ayuda de las herramientas del asistente: alimenta la pantalla de «qué puedo decir» y le dice al modelo para qué sirven.

export const AYUDAS: Record<'ver' | 'configurar', Ayuda> = {
  ver: {
    titulo: 'Ver la configuración del asistente',
    paraQueSirve: 'Muestra qué modelo usa el asistente de tu empresa, cuánto se ha gastado este mes y el tope, y los modelos que puedes elegir con su costo aproximado.',
    cuandoUsarla: 'Antes de cambiar el modelo o el tope, o para saber cuánto lleva gastado el asistente este mes.',
    campos: [],
    ejemploTecleado: 'ver la configuración del asistente',
    ejemploHablado: 'cuánto ha gastado el asistente este mes',
    erroresComunes: ['Si no se pudieron consultar los precios, el catálogo sale sin ellos; la configuración sigue vigente.'],
    relacionadas: ['agente_configurar'],
  },
  configurar: {
    titulo: 'Cambiar la configuración del asistente',
    paraQueSirve: 'Cambia el modelo que usa el asistente de tu empresa, su tope de gasto mensual y si puede hacer cambios directos. Envías solo lo que cambia; un valor vacío vuelve al del sistema.',
    cuandoUsarla: 'Cuando quieras otro modelo, ajustar cuánto puede gastar el asistente al mes, o activar que haga cambios por sí solo.',
    campos: [
      { nombre: 'modelo', queSeAnota: 'El modelo, con la forma «proveedor/nombre». Vacío vuelve al del sistema.', ejemplo: 'deepseek/deepseek-v4.1-flash-1017' },
      { nombre: 'topeMensualMicrousd', queSeAnota: 'El tope de gasto del mes por empresa, en millonésimas de dólar enteras (5 dólares = 5000000). Vacío vuelve al del sistema; 0 detiene al asistente.', ejemplo: '5000000' },
      { nombre: 'escrituraDirecta', queSeAnota: 'Si el asistente puede hacer cambios al momento (viene activado). Apagarlo es el freno de emergencia: todo cambio queda como borrador para aprobar.', ejemplo: 'false' },
      { nombre: 'dineroDirecto', queSeAnota: 'Si el asistente puede mover dinero por sí solo, con huella y topes (viene activado). Apagado, todo el dinero queda como borrador.', ejemplo: 'false' },
      { nombre: 'topePorOperacionCentimos', queSeAnota: 'El importe máximo por operación que el asistente mueve solo, en céntimos (S/ 1,000 = 100000). Por encima queda como borrador. Vacío vuelve al del sistema.', ejemplo: '100000' },
    ],
    ejemploTecleado: 'cambiar el modelo del asistente',
    ejemploHablado: 'pon el tope del asistente en cinco dólares al mes',
    erroresComunes: [
      'Hay que indicar al menos un dato.',
      'El modelo debe tener la forma «proveedor/nombre» y estar disponible.',
      'El tope va en millonésimas de dólar enteras, de 0 a 1,000,000,000.',
    ],
    relacionadas: ['agente_configuracion_ver'],
  },
};
