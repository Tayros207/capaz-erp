import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
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
        { nombre: 'texto', queSeAnota: 'El producto como lo dices (o productoId si es del catálogo).', ejemplo: 'cajas de bocaditos' },
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
  return [precioAnterior];
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
