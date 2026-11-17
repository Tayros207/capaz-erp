import { exito, formatearSoles, rechazo, type DeudaDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { puedeAnularseLaDeuda, puedeEditarseLaDeuda, validarVencimiento, type EstadoDeDeuda } from '../domain/deuda.js';
import { existeSucursal } from '../repositories/cuentas.repository.js';
import { anularDeuda, bloquearDeuda, deudaVivaPorOrigen, editarDeuda, verDeuda, type Deuda } from '../repositories/deudas.repository.js';
import { contarAbonosVivos, existeContacto } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { conflictoDeOrigen, crearDeudaYEmitir } from './deudas-comun.js';
import { aDeudaDto, codigoDeLaDeuda } from './mapeo.js';

// Escrituras de deudas: crear, corregir y anular (crítica). Abonar está en `deudas-abonar.ts`.

const NO_EXISTE = 'No existe esa deuda.';
const ID = { nombre: 'id', queSeAnota: 'Identificador de la deuda.', ejemplo: ID_DE_EJEMPLO };
const AUDITAR = (_a: unknown, d: DeudaDto | null) => ({
  entidadTipo: 'deuda',
  entidadId: d?.id,
  resumen: d ? { codigo: d.codigo, estado: d.estado, totalCentimos: d.totalCentimos } : undefined,
});

/** El documento de origen ya tiene una deuda viva: se ofrece esa en lugar de duplicarla. */
const yaTieneDeuda = (viva: Deuda) =>
  rechazo('conflicto', `Ese documento ya tiene la deuda ${codigoDeLaDeuda(viva)}.`, [
    { id: viva.id, nombre: codigoDeLaDeuda(viva), detalle: `Saldo ${formatearSoles(viva.totalCentimos - viva.abonadoCentimos)}` },
  ]);

export const deudaCrear = definirHerramienta('deuda_crear', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Anotar una deuda',
    paraQueSirve: 'Registra dinero que te deben (por cobrar) o que debes (por pagar), con su vencimiento. No mueve dinero: eso lo hacen los abonos.',
    cuandoUsarla: 'Cuando vendes o compras al crédito, o alguien queda debiendo una parte.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'por_cobrar o por_pagar.', ejemplo: 'por_cobrar' },
      { nombre: 'contactoId', queSeAnota: 'Cliente o proveedor.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'concepto', queSeAnota: 'Por qué se debe.', ejemplo: 'Banner 3x2 con instalación' },
      { nombre: 'totalCentimos', queSeAnota: 'Total en céntimos, mayor que cero.', ejemplo: '35000' },
      { nombre: 'venceEn', queSeAnota: 'Día en que vence (AAAA-MM-DD, opcional).', ejemplo: '2026-03-25' },
    ],
    ejemploTecleado: 'José Pérez me debe 350 por un banner, vence el 25 de marzo',
    ejemploHablado: 'anota que José Pérez me debe trescientos cincuenta soles por un banner, hasta el veinticinco',
    erroresComunes: ['El contacto no existe.', 'El vencimiento no puede ser anterior a la fecha.', 'Ese documento de origen ya tiene una deuda.'],
    relacionadas: ['deuda_abonar', 'deudas_listar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const vence = validarVencimiento(fecha, args.venceEn);
    if (!vence.ok) return rechazoDe(vence);
    if (!(await existeContacto(tx, ctx, args.contactoId))) return rechazo('no_encontrado', 'No existe ese contacto.');
    if (args.sucursalId && !(await existeSucursal(tx, ctx, args.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
    const origen = args.origenTipo && args.origenId ? { tipo: args.origenTipo, id: args.origenId } : null;
    const viva = origen ? await deudaVivaPorOrigen(tx, ctx, origen.tipo, origen.id) : null;
    if (viva) return yaTieneDeuda(viva);
    const creada = await crearDeudaYEmitir(tx, ctx, hoy, {
      tipo: args.tipo,
      contactoId: args.contactoId,
      concepto: args.concepto,
      totalCentimos: args.totalCentimos,
      fecha,
      venceEn: args.venceEn ?? null,
      sucursalId: args.sucursalId ?? null,
      notas: args.notas || null,
      origenTipo: origen?.tipo ?? null,
      origenId: origen?.id ?? null,
    });
    // Otra transacción creó la deuda de ese origen entre la consulta y el alta: el índice único la frenó.
    if (!creada) return conflictoDeOrigen();
    return exito(creada.dto);
  },
});

export const deudaEditar = definirHerramienta('deuda_editar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Corregir una deuda',
    paraQueSirve: 'Cambia el concepto, el vencimiento o las notas de una deuda. El total y el contacto no se cambian: para eso se anula y se crea otra.',
    cuandoUsarla: 'Cuando acuerdas otro plazo o quieres aclarar el concepto.',
    campos: [ID, { nombre: 'venceEn', queSeAnota: 'Nuevo vencimiento (AAAA-MM-DD) o null para quitarlo.', ejemplo: '2026-04-10' }],
    ejemploTecleado: 'cambiar el vencimiento de CXC-2026-0007 al 10 de abril',
    ejemploHablado: 'la deuda siete ahora vence el diez de abril',
    erroresComunes: ['Hay que indicar al menos un dato.', 'El vencimiento no puede ser anterior a la fecha de la deuda.', 'Una deuda anulada no se edita.'],
    relacionadas: ['deuda_ver', 'deuda_anular'],
  },
  auditar: (a, d) => ({ ...AUDITAR(a, d), entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const editable = puedeEditarseLaDeuda(actual.estado as EstadoDeDeuda);
    if (!editable.ok) return rechazoDe(editable);
    const vence = validarVencimiento(actual.fecha, args.venceEn);
    if (!vence.ok) return rechazoDe(vence);
    await editarDeuda(tx, ctx, args.id, {
      ...(args.concepto !== undefined && { concepto: args.concepto }),
      ...(args.venceEn !== undefined && { venceEn: args.venceEn }),
      ...(args.notas !== undefined && { notas: args.notas || null }),
    });
    const f = await verDeuda(tx, ctx, args.id, null);
    if (!f) throw new Error('La deuda editada no se pudo leer.');
    return exito(aDeudaDto(f, (await hoyDeLaEmpresa(tx)).dia));
  },
});

export const deudaAnular = definirHerramienta('deuda_anular', {
  modulo: MODULO,
  permiso: 'registro:anular',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Anular una deuda',
    paraQueSirve: 'Deja sin efecto una deuda mal anotada. No se borra: queda anulada con su motivo. Solo se puede si no tiene abonos vivos.',
    cuandoUsarla: 'Cuando la deuda se anotó por error o el trato se canceló antes de cobrar o pagar algo.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'El cliente canceló el pedido' }],
    ejemploTecleado: 'anular la deuda CXC-2026-0007 porque el cliente canceló el pedido',
    ejemploHablado: 'anula la cuenta por cobrar siete, el cliente canceló',
    erroresComunes: ['La deuda tiene abonos: anúlalos primero.', 'Esa deuda ya está anulada.', 'La confirmación venció o la deuda cambió: vuelve a pedirla.'],
    relacionadas: ['deuda_ver', 'movimiento_anular'],
  },
  auditar: (a, d) => ({ ...AUDITAR(a, d), entidadId: a.id }),
  async resumir(args, ctx, tx) {
    const f = await verDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!f) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    const regla = puedeAnularseLaDeuda({ estado: f.estado as EstadoDeDeuda, abonadoCentimos: f.abonadoCentimos }, await contarAbonosVivos(tx, ctx, f.id));
    if (!regla.ok) return { ok: false, error: { codigo: regla.codigo, mensaje: regla.mensaje } };
    const clase = f.tipo === 'por_cobrar' ? 'por cobrar' : 'por pagar';
    return {
      ok: true,
      resumen: {
        resumen: `Anularás la deuda ${clase} ${codigoDeLaDeuda(f)} de ${formatearSoles(f.totalCentimos)}. Dejará de contar en los saldos pendientes.`,
        huella: hashCanonico({ estado: f.estado, abonadoCentimos: f.abonadoCentimos }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const regla = puedeAnularseLaDeuda({ estado: actual.estado as EstadoDeDeuda, abonadoCentimos: actual.abonadoCentimos }, await contarAbonosVivos(tx, ctx, actual.id));
    if (!regla.ok) return rechazoDe(regla);
    if (!(await anularDeuda(tx, ctx, actual.id, args.motivo))) return rechazo('conflicto', 'La deuda cambió mientras se anulaba: vuelve a intentarlo.');
    await emitir(tx, 'deuda.anulada', { id: actual.id, codigo: codigoDeLaDeuda(actual) });
    const f = await verDeuda(tx, ctx, actual.id, null);
    if (!f) throw new Error('La deuda anulada no se pudo leer.');
    return exito(aDeudaDto(f, (await hoyDeLaEmpresa(tx)).dia));
  },
});
