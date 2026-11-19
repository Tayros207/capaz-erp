import { useState } from 'react';
import type { CandidatoParaGuiaDto, LineaPorEnviarDto, PedidoParaGuiaDto } from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import type { ErroresDeGuia, LineaLibre, SeleccionDeLinea } from './armado-de-guia.ts';
import { ETIQUETA_DE_ESTADO, formatearDia } from './logica.ts';

type PropsDeLinea = {
  linea: LineaPorEnviarDto;
  seleccion: SeleccionDeLinea | undefined;
  error?: string;
  alCambiar: (s: SeleccionDeLinea) => void;
};

function LineaDePedido({ linea, seleccion, error, alCambiar }: PropsDeLinea) {
  const incluida = !!seleccion?.incluir;
  const sinPendiente = linea.pendienteMilesimas <= 0;
  return (
    <li className="flex flex-col gap-2 py-3">
      <label className="flex min-h-(--alto-control) items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-accion"
          checked={incluida}
          disabled={sinPendiente}
          onChange={(e) => alCambiar({ incluir: e.target.checked, cantidadMilesimas: seleccion?.cantidadMilesimas ?? linea.pendienteMilesimas })}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words font-medium text-texto">{linea.descripcion}</span>
          <span className="text-sm text-texto-suave">
            {`Pedido ${formatearCantidad(linea.pedidaMilesimas, linea.unidad)} · Enviado ${formatearCantidad(linea.enviadaMilesimas, linea.unidad)} · Pendiente ${formatearCantidad(linea.pendienteMilesimas, linea.unidad)}`}
          </span>
        </span>
      </label>
      {incluida ? (
        <div className="pl-8 sm:max-w-56">
          <CampoCantidad etiqueta="Cantidad a enviar" unidad={linea.unidad} valor={seleccion?.cantidadMilesimas ?? null} error={error} alCambiar={(c) => alCambiar({ incluir: true, cantidadMilesimas: c })} />
        </div>
      ) : null}
    </li>
  );
}

type PropsDePedidos = {
  pedidos: readonly PedidoParaGuiaDto[];
  selecciones: Readonly<Record<string, SeleccionDeLinea>>;
  errores: ErroresDeGuia['lineas'];
  alCambiar: (lineaId: string, s: SeleccionDeLinea) => void;
  alQuitar: (pedidoId: string) => void;
};

/** Los pedidos de la guía con sus líneas: se marca lo que se envía y cuánto. */
export function PedidosDeLaGuia({ pedidos, selecciones, errores, alCambiar, alQuitar }: PropsDePedidos) {
  return (
    <div className="flex flex-col gap-3">
      {pedidos.map((p) => (
        <section key={p.id} aria-label={`Pedido ${p.codigo}`} className="rounded-md border border-borde bg-superficie p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-titulo font-semibold text-texto">{p.codigo}</h3>
            <Boton variante="fantasma" onClick={() => alQuitar(p.id)}>Quitar pedido</Boton>
          </div>
          <p className="text-sm text-texto-suave">{`${ETIQUETA_DE_ESTADO[p.estado]} · Entrega ${formatearDia(p.entregaEl)}`}</p>
          <ul className="divide-y divide-borde">
            {p.lineas.map((l) => (
              <LineaDePedido key={l.pedidoLineaId} linea={l} seleccion={selecciones[l.pedidoLineaId]} error={errores[l.pedidoLineaId]} alCambiar={(s) => alCambiar(l.pedidoLineaId, s)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Otros pedidos del mismo cliente que tienen algo por enviar. */
export function AgregarPedido({ candidatos, alAgregar }: { candidatos: readonly CandidatoParaGuiaDto[]; alAgregar: (id: string) => void }) {
  const [elegido, setElegido] = useState('');
  if (candidatos.length === 0) return <p className="text-sm text-texto-suave">Este cliente no tiene otros pedidos con algo por enviar.</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="sm:w-96">
        <CampoSelect etiqueta="Agregar otro pedido del mismo cliente" value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Elige un pedido</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>{`${c.codigo} · ${ETIQUETA_DE_ESTADO[c.estado]} · ${c.lineasPendientes} por enviar`}</option>
          ))}
        </CampoSelect>
      </div>
      <Boton icono="mas" disabled={!elegido} onClick={() => { alAgregar(elegido); setElegido(''); }}>Agregar pedido</Boton>
    </div>
  );
}

type PropsDeLibres = {
  libres: readonly LineaLibre[];
  errores: ErroresDeGuia['libres'];
  alCambiar: (clave: string, cambios: Partial<LineaLibre>) => void;
  alQuitar: (clave: string) => void;
  alAgregar: () => void;
};

/** Líneas que no vienen de un pedido: se escriben a mano. */
export function LineasLibres({ libres, errores, alCambiar, alQuitar, alAgregar }: PropsDeLibres) {
  return (
    <section aria-label="Líneas libres" className="flex flex-col gap-3">
      <h3 className="font-titulo font-semibold text-texto">Otras líneas</h3>
      {libres.map((l) => (
        <div key={l.clave} className="grid gap-2 rounded-md border border-borde bg-superficie p-3 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-start">
          <Campo etiqueta="Descripción" maxLength={300} value={l.descripcion} error={errores[l.clave]?.descripcion} onChange={(e) => alCambiar(l.clave, { descripcion: e.target.value })} />
          <Campo etiqueta="Unidad" maxLength={20} value={l.unidad} onChange={(e) => alCambiar(l.clave, { unidad: e.target.value })} />
          <CampoCantidad etiqueta="Cantidad" valor={l.cantidadMilesimas} error={errores[l.clave]?.cantidad} alCambiar={(c) => alCambiar(l.clave, { cantidadMilesimas: c })} />
          <Boton variante="fantasma" className="sm:mt-6" onClick={() => alQuitar(l.clave)}>Quitar</Boton>
        </div>
      ))}
      <div><Boton icono="mas" onClick={alAgregar}>Agregar línea libre</Boton></div>
    </section>
  );
}
