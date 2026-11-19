import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { consultarMiDia } from './mi-dia.js';
import { consultarPrecioAnterior } from './precios-anteriores.js';

export function crearHerramientasDeComposicion(ejecutor: EjecutorDeHerramientas, registro: RegistroDeHerramientas): HerramientaRegistrada[] {
  const precioAnterior = definirHerramienta('precio_anterior_consultar', {
    modulo: 'core',
    permiso: 'clientes:ver',
    criticidad: 'lectura',
    ayuda: {
      titulo: 'Precio anterior',
      paraQueSirve: 'Responde cuánto se le cobró la última vez a un cliente por un producto: último precio, fecha, cantidad, de qué documento salió y las veces anteriores.',
      cuandoUsarla: 'Cuando un cliente recurrente vuelve a pedir algo y no recuerdas cuánto se le cobró.',
      campos: [
        { nombre: 'clienteTexto', queSeAnota: 'Nombre del cliente tal como lo dices (o clienteId si ya lo tienes).', ejemplo: 'Cristina' },
        { nombre: 'texto', queSeAnota: 'El producto como lo dices (o productoId si es del catálogo). Sin producto, con el cliente, lista lo último que se le cobró por cada cosa.', ejemplo: 'cajas de bocaditos' },
        { nombre: 'limite', queSeAnota: 'Cuántas veces anteriores mostrar, hasta 30 (por defecto 10).', ejemplo: '10' },
      ],
      ejemploTecleado: 'cuánto le cobramos a Cristina por las cajas de bocaditos',
      ejemploHablado: 'precio anterior de volantes para Imprenta Sur',
      erroresComunes: [
        'Si hay varios clientes que se parecen, devuelve candidatos para que elijas uno.',
        'Solo incluye los módulos a los que tienes acceso; el aviso dice cuál falta.',
        'Una cotización solo cuenta como «Cotizado» cuando no hay pedido u orden de trabajo del mismo producto.',
      ],
      relacionadas: ['clientes_buscar', 'clientes_ver'],
    },
    auditar: (a, d) => ({ resumen: { conCliente: !!(a.clienteId || a.clienteTexto), ...(d && { historial: d.historial.length, hayUltimo: d.ultimo !== null }) } }),
    ejecutar: (args, ctx, tx) => consultarPrecioAnterior(ejecutor, registro, tx, ctx, args),
  });
  const miDia = definirHerramienta('mi_dia_ver', {
    modulo: 'core',
    permiso: null,
    criticidad: 'lectura',
    ayuda: {
      titulo: 'Mi día',
      paraQueSirve: 'Junta lo que hay que atender hoy: entregas de hoy, de mañana y atrasadas, a quién cobrar, cotizaciones sin respuesta, borradores por aprobar y alertas de insumos, solo de los módulos a los que tienes acceso.',
      cuandoUsarla: 'Cada mañana, al abrir el sistema. No envía ni cobra nada solo: cada tarjeta lleva a su ficha o propone una acción de un clic.',
      campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
      ejemploTecleado: 'qué tengo que hacer hoy',
      ejemploHablado: 'mi día',
      erroresComunes: ['Un módulo al que no tienes acceso no aparece; el aviso de «fuentes consultadas» dice cuál falta.', 'Con acceso solo a tus propios registros, ves únicamente lo tuyo.'],
      relacionadas: ['borradores_listar', 'precio_anterior_consultar'],
    },
    auditar: (_a, d) => ({ ...(d && { resumen: { total: d.total, porAprobar: d.resumen.porAprobar } }) }),
    ejecutar: (args, ctx, tx) => consultarMiDia(ejecutor, registro, tx, ctx, args),
  });
  return [precioAnterior, miDia];
}

/** La herramienta compuesta del núcleo: descubre las subherramientas de los módulos por su nombre, no las importa. */
@Injectable()
export class HerramientasDeComposicion implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(EjecutorDeHerramientas) private readonly ejecutor: EjecutorDeHerramientas,
  ) {}

  onModuleInit(): void {
    this.registro.agregar(crearHerramientasDeComposicion(this.ejecutor, this.registro));
  }
}
