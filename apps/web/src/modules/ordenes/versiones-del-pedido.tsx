import { Link } from 'react-router';
import type { PedidoCompletoDto, VentaCorregidaDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import type { SaldoDelPedido } from './deuda-del-pedido.ts';
import { ETIQUETA_DE_MEDIO } from './adelanto.ts';
import { estadoDePago, textoDeVencimiento } from './documentos.ts';
import { textoDeMotivo } from './huella-de-correccion.ts';
import { formatearDia } from './logica.ts';

/** Lo pagado y lo que falta, siempre que el pedido tenga deuda: estado, vencimiento y cada abono con su medio. «A favor del cliente» solo si pagó de más. */
export function PagosDelPedido({ saldo }: { saldo: SaldoDelPedido | null }) {
  if (!saldo) return null;
  const estado = estadoDePago(saldo.estadoDeuda);
  const vence = textoDeVencimiento(saldo.estadoDeuda);
  const sinAdelanto = saldo.abonadoCentimos <= 0;
  return (
    <section aria-label="Pagos del pedido" className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-3 text-texto">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-titulo font-semibold">Pago</h2>
        {estado ? <span className={estado === 'Pagado' ? 'font-semibold text-exito' : estado === 'Vencida' ? 'font-semibold text-peligro' : 'font-semibold text-aviso'}>{estado}</span> : null}
        {vence ? <span className="text-sm text-texto-suave">{vence}</span> : null}
      </div>
      <p>
        {sinAdelanto ? 'Sin adelanto' : <>Ya pagó <strong>{formatearSoles(saldo.abonadoCentimos)}</strong></>} · Falta <strong>{formatearSoles(saldo.saldoCentimos)}</strong> de {formatearSoles(saldo.totalCentimos)}
      </p>
      {saldo.abonos.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-sm text-texto-suave">
          {saldo.abonos.map((a, i) => (
            <li key={`${a.fecha}-${i}`}>{formatearDia(a.fecha)} · {formatearSoles(a.montoCentimos)} · {ETIQUETA_DE_MEDIO[a.medio]} · {a.cuentaNombre}</li>
          ))}
        </ul>
      ) : null}
      {saldo.aFavorCentimos > 0 ? <p className="font-semibold text-exito">A favor del cliente: {formatearSoles(saldo.aFavorCentimos)}</p> : null}
      <Link to={`/m/registro/deudas/${saldo.deudaId}`} className="w-fit text-sm font-medium text-accion underline">Ver la deuda {saldo.codigo}</Link>
    </section>
  );
}

/** «Versiones anteriores»: cada una guardada tal como era, con su reimpresión marcada REEMPLAZADA. */
export function VersionesAnteriores({ pedido }: { pedido: PedidoCompletoDto }) {
  if (pedido.versiones.length === 0) return null;
  return (
    <section aria-label="Versiones anteriores" className="flex flex-col gap-2">
      <h2 className="font-titulo font-semibold text-texto">Versiones anteriores</h2>
      <ul className="flex flex-col gap-2">
        {pedido.versiones.map((v) => (
          <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 rounded-tarjeta border border-borde bg-superficie p-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-texto">Versión {v.version} · {formatearSoles(v.foto.totalCentimos)}</span>
              <span className="break-words text-sm text-texto-suave">
                Reemplazada el {formatearFechaHora(v.creadoEn)}{v.creadoPorNombre ? ` por ${v.creadoPorNombre}` : ''} · {textoDeMotivo(v.motivoCodigo, v.motivoTexto)}
              </span>
            </span>
            <Link to={`/m/ordenes/${pedido.id}/nota?version=${v.version}`} className="inline-flex min-h-(--alto-control) items-center rounded-control px-3 font-medium text-accion underline">Ver / reimprimir v{v.version}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type AvisoProps = {
  resultado: VentaCorregidaDto;
  alWhatsApp: () => void;
  alImprimirNota: () => void;
  alImprimirOrden: (() => void) | null;
  alHistorial: () => void;
  alCerrar: () => void;
};

/** Aviso en la misma pantalla (no modal) tras guardar la versión nueva. */
export function AvisoDeVersion({ resultado, alWhatsApp, alImprimirNota, alImprimirOrden, alHistorial, alCerrar }: AvisoProps) {
  const p = resultado.pedido;
  return (
    <section role="status" aria-label="Pedido corregido" className="flex flex-col gap-3 rounded-tarjeta border border-exito/40 bg-exito/10 p-4">
      <p className="font-titulo text-base font-semibold text-texto">Pedido {p.codigo} ahora es versión {p.version}</p>
      {resultado.avisos.map((a) => <p key={a} className="text-sm text-texto">{a}</p>)}
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={alWhatsApp}>{`Enviar v${p.version} por WhatsApp`}</Boton>
        <Boton onClick={alImprimirNota}>{`Imprimir nota de pedido v${p.version}`}</Boton>
        {alImprimirOrden ? <Boton onClick={alImprimirOrden}>{`Imprimir orden de trabajo v${p.version}`}</Boton> : null}
        <Boton variante="fantasma" onClick={alHistorial}>Ver historial</Boton>
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar aviso</Boton>
      </div>
    </section>
  );
}
