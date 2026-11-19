import { exito, limitarTarjetas, sumarDias, type TarjetaDePendiente } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { agruparCobros, anotacionesDeDeudas, type CobroDeCliente } from '../domain/cobros-pendientes.js';
import { mensajeDeCobro } from '../domain/mensaje-de-cobro.js';
import { deudasConOrigen, deudasPorCobrarAbiertas, nombreDeLaEmpresa } from '../repositories/pendientes.repository.js';
import { MODULO, propietarioDe } from './comun.js';

// «Mi día» del módulo registro: a quién cobrar (con su mensaje listo, que se abre a mano) y las anotaciones de pagado o
// saldo de los pedidos y órdenes de trabajo. Solo lee. Los cobros «entregado, falta cobrar» son borradores que el sistema
// ya propuso: los trae el núcleo desde la bandeja, aquí no se repiten.

const enDias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function tarjetaDeCobro(c: CobroDeCliente, empresa: string | null, hoy: string): TarjetaDePendiente {
  return {
    clave: `cobrar:${c.contactoId}`,
    grupo: 'cobro',
    urgencia: 'atrasado',
    titulo: `Cobrar a ${c.contactoNombre}`,
    detalle: `${c.deudas} ${c.deudas === 1 ? 'deuda vencida' : 'deudas vencidas'}, la más antigua hace ${enDias(c.diasMasAntiguo)}`,
    // El día desde el que corre la más antigua: el panel ordena por fecha, así la deuda más vieja va primero.
    fecha: sumarDias(hoy, -c.diasMasAntiguo),
    montoCentimos: c.totalCentimos,
    cliente: { id: c.contactoId, nombre: c.contactoNombre, telefono: c.contactoTelefono },
    entidad: { tipo: 'cliente', id: c.contactoId, codigo: c.contactoNombre },
    acciones: [],
    mensaje: mensajeDeCobro({ cliente: c.contactoNombre, empresa, montoCentimos: c.totalCentimos, diasMasAntiguo: c.diasMasAntiguo, telefono: c.contactoTelefono }),
    cobro: { tramo0a30Centimos: c.tramo0a30Centimos, tramo31a60Centimos: c.tramo31a60Centimos, tramo61masCentimos: c.tramo61masCentimos, diasMasAntiguo: c.diasMasAntiguo, deudas: c.deudas },
  };
}

export const registroPendientes = definirHerramienta('registro_pendientes', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de cobro (Mi día)',
    paraQueSirve: 'Dice a quién conviene cobrar hoy (deudas vencidas por cliente, con su antigüedad y un mensaje de cobro redactado) y si los pedidos y trabajos ya están pagados o con saldo.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para repasar a quién cobrar sin abrir cada deuda.',
    campos: [{ nombre: 'fecha', queSeAnota: 'Día de corte (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'a quién tengo que cobrar hoy',
    ejemploHablado: 'quién me debe y ya venció',
    erroresComunes: ['Con acceso solo a tus propios registros, ves únicamente las deudas que tú anotaste.'],
    relacionadas: ['deudas_listar', 'deudas_antiguedad'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, anotaciones: d.anotaciones.length } }) }),
  async ejecutar(args, ctx, tx) {
    const hoy = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const propietario = propietarioDe(ctx);
    const cobros = agruparCobros(await deudasPorCobrarAbiertas(tx, ctx, propietario), hoy);
    const empresa = cobros.length > 0 ? await nombreDeLaEmpresa(tx) : null;
    const { tarjetas, total } = limitarTarjetas(cobros.map((c) => tarjetaDeCobro(c, empresa, hoy)));
    const anotaciones = anotacionesDeDeudas(await deudasConOrigen(tx, ctx, propietario));
    return exito({ fecha: hoy, tarjetas, anotaciones, total });
  },
});

