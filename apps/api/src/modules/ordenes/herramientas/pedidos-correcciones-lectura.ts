import { exito, rechazo, type CorreccionListadaDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { esAdministrador, resumenDeCorreccion } from '../domain/correccion.js';
import { codigoDePedido } from '../domain/pedido.js';
import { listarCorrecciones } from '../repositories/correccion.repository.js';
import { MODULO, alcanceDePedidos } from './comunes.js';

// La huella de las correcciones de pedidos, para listarla en el ERP. El dueño y los administradores ven todas; los demás,
// solo las que hicieron ellos mismos (y solo de los pedidos a los que su alcance llega).

export const pedidoCorreccionesListar = definirHerramienta('pedido_correcciones_listar', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Correcciones de pedidos',
    paraQueSirve: 'Lista las correcciones hechas a pedidos confirmados: qué pedido, quién, cuándo, el motivo, el antes y el después y cuánto cambió el total.',
    cuandoUsarla: 'Para revisar quién corrigió qué y por qué. El dueño y los administradores ven todas; cada trabajador, solo las suyas.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período (opcional).', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período (opcional).', ejemplo: '2026-03-31' },
      { nombre: 'autorId', queSeAnota: 'Solo las de una persona (opcional; un trabajador solo ve las suyas).', ejemplo: 'usuario-123' },
      { nombre: 'pedidoId', queSeAnota: 'Solo las de un pedido (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' },
    ],
    ejemploTecleado: 'qué correcciones se hicieron en marzo',
    ejemploHablado: 'quién corrigió pedidos este mes',
    erroresComunes: ['El período empieza antes de terminar.', 'El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['correcciones_listar', 'pedido_ver', 'pedido_corregir'],
  },
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await listarCorrecciones(tx, ctx, alcanceDePedidos(ctx), { desde: args.desde, hasta: args.hasta, pedidoId: args.pedidoId, limite: args.limite, cursor: args.cursor, usuarioId: esAdministrador(ctx.rol) ? args.autorId : ctx.usuarioId, zona: hoy.zona });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const items: CorreccionListadaDto[] = [];
    for (const f of r.items) {
      const c = f.detalle.correccion;
      if (!c) continue;
      items.push({
        eventoId: f.eventoId,
        pedido: { id: f.pedidoId, codigo: codigoDePedido(f.serie, f.anio, f.numero), clienteNombre: f.clienteNombre },
        versionAnterior: c.versionAnterior,
        version: c.versionNueva,
        usuarioId: f.usuarioId,
        usuarioNombre: f.usuarioNombre,
        creadoEn: f.creadoEn.toISOString(),
        motivoCodigo: c.motivoCodigo,
        motivoTexto: c.motivoTexto,
        totalAnteriorCentimos: c.totalAnteriorCentimos,
        totalNuevoCentimos: c.totalNuevoCentimos,
        deltaCentimos: c.deltaCentimos,
        resumen: resumenDeCorreccion(c),
        correccion: c,
      });
    }
    return exito({ items, siguiente: r.siguiente });
  },
});
