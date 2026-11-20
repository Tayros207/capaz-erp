import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { RegistroDeHerramientas } from '../herramientas/registro.js';
import { definirHerramienta, type HerramientaRegistrada } from '../herramientas/tipos.js';
import { listarCorrecciones } from './correcciones.js';
import { consultarMiDia } from './mi-dia.js';
import { consultarPrecioAnterior } from './precios-anteriores.js';
import { aplicarVentaCorregida, resumirVentaCorregida } from './venta-corregir.js';

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
  const ventaCorregir = definirHerramienta('venta_corregir', {
    modulo: 'core',
    permiso: null,
    criticidad: 'critica',
    // Si la red cae justo al confirmar, la pantalla reenvía con la misma clave: el servidor devuelve lo que ya guardó, no repite.
    idempotente: true,
    mueveDinero: true,
    ayuda: {
      titulo: 'Corregir venta',
      paraQueSirve: 'Corrige un pedido ya confirmado (versión 2: mismo número, la anterior queda guardada) y ajusta la deuda del cliente en un solo paso, con una sola confirmación. Lo ya pagado no se toca; si el cliente pagó de más, queda a su favor (no se devuelve). Deja constancia de quién, cuándo, antes y después y por qué.',
      cuandoUsarla: 'Cuando el importe o las líneas de un pedido confirmado cambian (precio acordado, IGV, cantidad) y la deuda debe seguirlo. Si no llevas Finanzas, el ajuste de la deuda queda como borrador para quien sí.',
      campos: [
        { nombre: 'id', queSeAnota: 'Identificador del pedido.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' },
        { nombre: 'motivoCodigo', queSeAnota: 'Por qué: igv, precio_acordado, cantidad, lineas, error_digitacion u otro.', ejemplo: 'precio_acordado' },
        { nombre: 'motivoTexto', queSeAnota: 'Explicación breve (obligatoria con «otro»).', ejemplo: 'El cliente negoció por volumen' },
        { nombre: 'lineas', queSeAnota: 'El pedido completo como debe quedar (las líneas con id se actualizan, las que faltan se quitan, las sin id se agregan).', ejemplo: '[{ "id": "...", "descripcion": "Volantes A5", "unidad": "millar", "cantidadMilesimas": 2000, "precioUnitarioMilesimas": 55000, "afectoIgv": true }]' },
        { nombre: 'fijarTotalCentimos', queSeAnota: 'Deja el total en ese importe repartiendo el cambio entre los precios (opcional).', ejemplo: '50000' },
        { nombre: 'versionEsperada', queSeAnota: 'La versión del pedido que tenías a la vista (pedido_ver); si otra persona lo corrigió antes, se rechaza.', ejemplo: '1' },
      ],
      ejemploTecleado: 'corregir el pedido PED-PRI-2026-0007: quedó en 500 soles por precio acordado',
      ejemploHablado: 'el pedido siete quedó en quinientos, corrige la venta',
      erroresComunes: [
        'Un trabajador corrige hasta 10 % del total y S/ 100 sin aprobación; más allá hay que pedir al dueño o administrador.',
        'No se puede cambiar el cliente si el pedido tiene abonos.',
        'No se puede quitar una línea que ya figura en una guía de remisión ni bajar su cantidad por debajo de lo enviado.',
        'La confirmación venció o los datos cambiaron: vuelve a pedirla.',
        'Otra persona corrigió el pedido mientras tanto (ya va en otra versión): vuelve a verlo y corrige sobre lo último.',
      ],
      relacionadas: ['pedido_corregir', 'deuda_ajustar', 'correcciones_listar', 'pedido_ver'],
    },
    auditar: (a, d) => ({ entidadTipo: 'pedido', entidadId: a.id, resumen: { motivo: a.motivoCodigo, ...(d && { codigo: d.pedido.codigo, version: d.pedido.version, deltaCentimos: d.correccion.deltaCentimos, aFavorCentimos: d.aFavorCentimos }) } }),
    resumir: (args, ctx, tx) => resumirVentaCorregida(ejecutor, tx, ctx, args),
    ejecutar: (args, ctx, tx) => aplicarVentaCorregida(ejecutor, tx, ctx, args),
  });
  const correccionesListar = definirHerramienta('correcciones_listar', {
    modulo: 'core',
    permiso: null,
    criticidad: 'lectura',
    ayuda: {
      titulo: 'Correcciones de ventas',
      paraQueSirve: 'Lista las correcciones de pedidos confirmados con quién, cuándo, motivo, antes y después, cuánto cambió el total y el ajuste de la deuda que produjeron. El dueño y los administradores ven todas; cada trabajador, solo las suyas.',
      cuandoUsarla: 'Para revisar quién cambió importes de ventas ya confirmadas y por qué.',
      campos: [
        { nombre: 'desde', queSeAnota: 'Primer día del período (opcional).', ejemplo: '2026-03-01' },
        { nombre: 'hasta', queSeAnota: 'Último día del período (opcional).', ejemplo: '2026-03-31' },
        { nombre: 'autorId', queSeAnota: 'Solo las de una persona (opcional).', ejemplo: 'usuario-123' },
        { nombre: 'pedidoId', queSeAnota: 'Solo las de un pedido (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' },
      ],
      ejemploTecleado: 'qué ventas se corrigieron este mes',
      ejemploHablado: 'quién corrigió ventas en marzo',
      erroresComunes: ['Hace falta acceso a Pedidos.', 'El ajuste de la deuda solo se muestra a quien ve Finanzas.'],
      relacionadas: ['venta_corregir', 'pedido_correcciones_listar', 'deuda_ajustes_listar'],
    },
    auditar: (_a, d) => ({ ...(d && { resumen: { total: d.items.length } }) }),
    ejecutar: (args, ctx, tx) => listarCorrecciones(ejecutor, tx, ctx, args),
  });
  return [precioAnterior, miDia, ventaCorregir, correccionesListar];
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
