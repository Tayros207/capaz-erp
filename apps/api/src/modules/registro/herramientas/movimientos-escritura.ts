import { exito, formatearSoles, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { revertirAbono, type EstadoDeDeuda } from '../domain/deuda.js';
import { categoriaUtilizable, fechaDeMovimiento, puedeAnularseElMovimiento } from '../domain/movimiento.js';
import { asegurarCatalogos } from '../repositories/catalogos.repository.js';
import { verCategoria } from '../repositories/categorias.repository.js';
import { existeSucursal } from '../repositories/cuentas.repository.js';
import { bloquearDeuda, guardarAbonado, verDeuda } from '../repositories/deudas.repository.js';
import { anularMovimiento, bloquearMovimiento, existeContacto, verMovimiento } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { guardarMovimiento, resolverCuenta } from './guardar-movimiento.js';
import { aMovimientoDto, codigoDe, codigoDeLaDeuda } from './mapeo.js';

// Escrituras de movimientos: registrar (mueve dinero) y anular (crítica). Un movimiento nunca se edita ni se borra.

const NO_EXISTE = 'No existe ese movimiento.';

export const movimientoRegistrar = definirHerramienta('movimiento_registrar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  mueveDinero: true,
  ayuda: {
    titulo: 'Registrar un ingreso o un egreso',
    paraQueSirve: 'Anota dinero que entró o salió de una cuenta. Si no indicas cuenta, usa la principal; si no indicas fecha, es hoy.',
    cuandoUsarla: 'Cada vez que cobras, pagas o gastas algo que no es el abono de una deuda ya anotada.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'ingreso o egreso.', ejemplo: 'egreso' },
      { nombre: 'montoCentimos', queSeAnota: 'Monto en céntimos, mayor que cero.', ejemplo: '4550' },
      { nombre: 'fecha', queSeAnota: 'Día del movimiento (AAAA-MM-DD); no puede ser futuro.', ejemplo: '2026-03-10' },
      { nombre: 'cuentaId', queSeAnota: 'Cuenta de la que entra o sale (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'categoriaId', queSeAnota: 'Categoría del mismo tipo que el movimiento (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'contactoId', queSeAnota: 'Cliente o proveedor (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'medioDePago', queSeAnota: 'efectivo, transferencia, yape, plin, tarjeta u otro.', ejemplo: 'yape' },
      { nombre: 'descripcion', queSeAnota: 'Nota breve (opcional).', ejemplo: 'Tinta para plotter' },
    ],
    ejemploTecleado: 'egreso de 45.50 por tinta para plotter, pagado con yape',
    ejemploHablado: 'anota un gasto de cuarenta y cinco soles con cincuenta en tinta, lo pagué por yape',
    erroresComunes: ['La fecha no puede ser futura.', 'La categoría es del otro tipo de movimiento.', 'La cuenta está archivada.'],
    relacionadas: ['movimientos_listar', 'cuentas_listar', 'categorias_listar', 'deuda_abonar'],
  },
  auditar: (_a, d) => ({ entidadTipo: 'movimiento', entidadId: d?.id, resumen: d ? { codigo: d.codigo, tipo: d.tipo, montoCentimos: d.montoCentimos } : undefined }),
  async ejecutar(args, ctx, tx) {
    await asegurarCatalogos(tx, ctx);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = fechaDeMovimiento(args.fecha, hoy.dia);
    if (!fecha.ok) return rechazoDe(fecha);
    const cuenta = await resolverCuenta(tx, ctx, args.cuentaId);
    if (!cuenta.ok) return cuenta;
    if (args.categoriaId) {
      const categoria = await verCategoria(tx, ctx, args.categoriaId);
      if (!categoria) return rechazo('no_encontrado', 'No existe esa categoría.');
      const regla = categoriaUtilizable(args.tipo, categoria);
      if (!regla.ok) return rechazoDe(regla);
    }
    if (args.contactoId && !(await existeContacto(tx, ctx, args.contactoId))) return rechazo('no_encontrado', 'No existe ese contacto.');
    if (args.sucursalId && !(await existeSucursal(tx, ctx, args.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
    const r = await guardarMovimiento(tx, ctx, hoy.anio, cuenta.cuenta, {
      tipo: args.tipo,
      fecha: fecha.fecha,
      montoCentimos: args.montoCentimos,
      categoriaId: args.categoriaId ?? null,
      contactoId: args.contactoId ?? null,
      medioDePago: args.medioDePago,
      descripcion: args.descripcion || null,
      deudaId: null,
      sucursalId: args.sucursalId ?? null,
      origen: args.origen,
      origenRef: args.origenRef || null,
    });
    return exito(aMovimientoDto(r.movimiento), { avisos: r.avisos });
  },
});

export const movimientoAnular = definirHerramienta('movimiento_anular', {
  modulo: MODULO,
  permiso: 'registro:anular',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Anular un movimiento',
    paraQueSirve: 'Deja sin efecto un ingreso o egreso mal registrado. No se borra: queda marcado como anulado con su motivo. Si era el abono de una deuda, el monto vuelve al saldo de esa deuda.',
    cuandoUsarla: 'Cuando un movimiento se registró por error o con datos equivocados. Para corregirlo, anúlalo y regístralo de nuevo.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador del movimiento.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se registró dos veces' },
    ],
    ejemploTecleado: 'anular el movimiento MOV-2026-000123 porque se registró dos veces',
    ejemploHablado: 'anula el movimiento ciento veintitrés, estaba duplicado',
    erroresComunes: ['Ese movimiento ya está anulado.', 'La confirmación venció o el movimiento cambió: vuelve a pedirla.'],
    relacionadas: ['movimiento_ver', 'movimiento_registrar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'movimiento', entidadId: a.id, resumen: d ? { codigo: d.codigo, estado: d.estado, eraAbono: d.deudaId !== null } : undefined }),
  async resumir(args, ctx, tx) {
    const mov = await verMovimiento(tx, ctx, args.id, propietarioDe(ctx));
    if (!mov) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    const regla = puedeAnularseElMovimiento(mov.estado);
    if (!regla.ok) return { ok: false, error: { codigo: regla.codigo, mensaje: regla.mensaje } };
    const deuda = mov.deudaId ? await verDeuda(tx, ctx, mov.deudaId, null) : null;
    let resumen = `Anularás el ${mov.tipo} ${codigoDe(mov)} de ${formatearSoles(mov.montoCentimos)}.`;
    if (deuda) {
      const despues = revertirAbono({ estado: deuda.estado as EstadoDeDeuda, totalCentimos: deuda.totalCentimos, abonadoCentimos: deuda.abonadoCentimos }, mov.montoCentimos);
      resumen += ` La deuda ${codigoDeLaDeuda(deuda)} volverá a tener ${formatearSoles(despues.saldoCentimos)} de saldo.`;
    }
    return { ok: true, resumen: { resumen, huella: hashCanonico({ estado: mov.estado, deudaId: mov.deudaId, abonado: deuda?.abonadoCentimos ?? null }) } };
  },
  async ejecutar(args, ctx, tx) {
    const propietario = propietarioDe(ctx);
    const previo = await verMovimiento(tx, ctx, args.id, propietario);
    if (!previo) return rechazo('no_encontrado', NO_EXISTE);
    // Orden de bloqueo igual que al abonar (primero la deuda, después el movimiento): sin interbloqueos.
    const deuda = previo.deudaId ? await bloquearDeuda(tx, ctx, previo.deudaId, null) : null;
    if (previo.deudaId && !deuda) throw new Error('El abono apunta a una deuda que no existe.');
    const mov = await bloquearMovimiento(tx, ctx, args.id, propietario);
    if (!mov) return rechazo('no_encontrado', NO_EXISTE);
    const regla = puedeAnularseElMovimiento(mov.estado);
    if (!regla.ok) return rechazoDe(regla);
    if (!(await anularMovimiento(tx, ctx, mov.id, args.motivo))) return rechazo('conflicto', 'Ese movimiento ya está anulado.');
    if (deuda) {
      const despues = revertirAbono({ estado: deuda.estado as EstadoDeDeuda, totalCentimos: deuda.totalCentimos, abonadoCentimos: deuda.abonadoCentimos }, mov.montoCentimos);
      await guardarAbonado(tx, ctx, deuda.id, despues.abonadoCentimos, despues.estado);
    }
    await emitir(tx, 'movimiento.anulado', { id: mov.id, codigo: codigoDe(mov), deudaId: mov.deudaId });
    const final = await verMovimiento(tx, ctx, mov.id, null);
    if (!final) throw new Error('El movimiento anulado no se pudo leer.');
    return exito(aMovimientoDto(final));
  },
});
