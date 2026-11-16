import { createElement } from 'react';
import type { ModuloDeEmpresaDto } from '@capaz/shared';
import { formatearFecha } from '../shared/formato/fechas.ts';
import { formatearSoles } from '../shared/formato/soles.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { MenuDeAcciones } from '../shared/ui/datos/menu-de-acciones.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { unir } from '../shared/ui/unir.ts';
import { CodigoDeModulo } from './chip-modulo.tsx';
import { iconoDeModulo } from './iconos-de-modulo.ts';
import { accionesPosibles, diasHasta, ETIQUETA_DE_ACCION, estadoDeModulo, nombreDeModulo, textoDeVencimiento, type AccionDeModulo } from './logica.ts';

const BORDE: Record<ModuloDeEmpresaDto['estado'], string> = { prueba: 'bg-info', activo: 'bg-exito', suspendido: 'bg-aviso', baja: 'bg-peligro' };

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[0.6875rem] font-medium tracking-wide text-texto-suave uppercase">{etiqueta}</dt>
      <dd className="truncate text-sm font-medium text-texto tabular-nums">{children}</dd>
    </div>
  );
}

function Cuenta({ m, ahora }: { m: ModuloDeEmpresaDto; ahora: Date }) {
  const objetivo = m.estado === 'prueba' ? m.pruebaHasta : m.estado === 'baja' ? null : m.vigenteHasta;
  const dias = diasHasta(objetivo, ahora);
  if (m.estado === 'baja') return <p className="text-sm text-texto-suave">De baja desde {m.bajaEn ? formatearFecha(m.bajaEn) : '—'}. Solo lectura; los datos se conservan.</p>;
  if (dias === null) return <p className="text-sm text-texto-suave">{m.estado === 'prueba' ? 'Prueba sin fecha.' : 'Sin vigencia acordada.'}</p>;
  const tono = dias < 0 ? 'text-peligro' : dias <= 7 ? 'text-aviso' : 'text-exito';
  return (
    <p className={unir('text-sm font-medium', tono)}>
      {textoDeVencimiento(dias)} <span className="font-normal text-texto-suave">· {m.estado === 'prueba' ? 'prueba' : 'vigencia'} hasta {formatearFecha(objetivo!)}</span>
    </p>
  );
}

export function TarjetaDeModulo({ m, ahora, alContrato, alAccionar }: { m: ModuloDeEmpresaDto; ahora: Date; alContrato: () => void; alAccionar: (a: AccionDeModulo) => void }) {
  const estado = estadoDeModulo(m.estado);
  const acciones = accionesPosibles(m.estado).map((a) => ({ etiqueta: ETIQUETA_DE_ACCION[a], onSeleccionar: () => alAccionar(a), peligro: a !== 'reactivar' }));
  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta transition-shadow hover:shadow-elevada">
      <span aria-hidden className={unir('absolute inset-x-0 top-0 h-0.5', BORDE[m.estado])} />
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-tarjeta bg-superficie-alta text-texto-suave">
          {createElement(iconoDeModulo(m.modulo), { className: 'size-5', strokeWidth: 1.75 })}
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <h3 className="font-titulo text-base leading-tight font-semibold text-texto">{m.nombre || nombreDeModulo(m.modulo)}</h3>
          <CodigoDeModulo codigo={m.modulo} />
        </div>
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
      </div>
      <Cuenta m={m} ahora={ahora} />
      {m.plan !== null || m.precioAcordadoCentimos !== null || m.maxUsuarios !== null ? (
        <dl className="grid grid-cols-3 gap-3 border-t border-borde pt-3">
          <Dato etiqueta="Plan">{m.plan ?? '—'}</Dato>
          <Dato etiqueta="Precio">{m.precioAcordadoCentimos === null ? '—' : formatearSoles(m.precioAcordadoCentimos)}</Dato>
          <Dato etiqueta="Máx. usuarios">{m.maxUsuarios ?? '—'}</Dato>
        </dl>
      ) : (
        <p className="border-t border-borde pt-3 text-sm text-texto-suave">Sin plan, precio ni límite acordados.</p>
      )}
      {m.motivo ? <p className="rounded-control bg-superficie-alta px-3 py-2 text-xs text-texto-suave">Motivo: {m.motivo}</p> : null}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <Boton onClick={alContrato}>{m.plan !== null || m.precioAcordadoCentimos !== null || m.maxUsuarios !== null || m.vigenteHasta !== null ? 'Contrato' : 'Definir contrato'}</Boton>
        <MenuDeAcciones etiqueta={`Acciones de ${m.nombre || nombreDeModulo(m.modulo)}`} acciones={acciones} />
      </div>
    </li>
  );
}
