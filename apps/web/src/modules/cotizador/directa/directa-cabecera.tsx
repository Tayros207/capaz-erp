import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { HojaNuevoCliente } from '../../../core/clientes/hoja-nuevo-cliente.tsx';
import { verCliente } from '../../../core/clientes/api.ts';
import { datosOError } from '../../../shared/api/consultas.ts';
import { formatearFecha } from '../../../shared/formato/fechas.ts';
import { useDatosDeEmpresaParaImprimir } from '../../../shared/impresion/usar-datos-de-empresa.ts';
import { Campo } from '../../../shared/ui/campo.tsx';
import { SelectorDeRegistro } from '../../../shared/ui/selector-de-registro.tsx';
import { buscarClientes } from '../api.ts';
import { clientesIniciales } from '../clientes-iniciales.ts';
import type { ErroresDeHoja, HojaDirecta } from './logica-directa.ts';

type Props = {
  hoja: HojaDirecta;
  errores: ErroresDeHoja;
  emitida: CotizacionCompletaDto | null;
  alCambiar: (cambio: Partial<HojaDirecta>) => void;
};

async function buscarDeClientes(texto: string) {
  return datosOError(await buscarClientes(texto)).items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}

function DatosDelCliente({ id }: { id: string }) {
  const c = useQuery({ queryKey: ['clientes', 'ficha-para-directa', id], queryFn: async () => datosOError(await verCliente(id)), staleTime: 60_000 });
  if (!c.data) return null;
  return (
    <p className="text-sm text-texto-suave">
      RUC / documento: <span className="text-texto">{c.data.documentoNumero ?? 'sin registrar'}</span> · Teléfono: <span className="text-texto">{c.data.telefono ?? 'sin registrar'}</span>
    </p>
  );
}

/** Lo de arriba de la hoja: quién cotiza, fecha, número, para quién y a qué se refiere. */
export function DirectaCabecera({ hoja, errores, emitida, alCambiar }: Props) {
  const { datos: empresa } = useDatosDeEmpresaParaImprimir();
  const [nuevoCliente, setNuevoCliente] = useState<string | null>(null);
  async function elegirCreado(id: string) {
    setNuevoCliente(null);
    alCambiar({ cliente: { id, nombre: datosOError(await verCliente(id)).nombre } });
  }
  const soloLectura = emitida !== null;
  return (
    <section aria-label="Datos de la cotización" className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
      <HojaNuevoCliente abierto={nuevoCliente !== null} nombreInicial={nuevoCliente ?? ''} alCerrar={() => setNuevoCliente(null)} alCrear={(id) => void elegirCreado(id)} alAbrirExistente={(id) => void elegirCreado(id)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-titulo text-lg font-semibold text-texto">{empresa?.razonSocial ?? 'Tu empresa'}</p>
          <p className="text-sm text-texto-suave">{empresa?.ruc ? `RUC ${empresa.ruc}` : 'RUC sin registrar'}</p>
          {empresa && !empresa.ruc ? (
            <p role="status" className="text-sm text-texto">
              Falta el RUC de la empresa; el documento saldrá incompleto. <Link to="/ajustes/empresa" className="font-medium underline">Completar en Ajustes › Empresa</Link>
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-texto-suave">Fecha</dt>
          <dd className="text-texto">{formatearFecha(new Date())}</dd>
          <dt className="text-texto-suave">Número</dt>
          <dd className="font-medium text-texto">{emitida ? emitida.codigo : 'Se numera al emitir'}</dd>
        </dl>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {soloLectura ? (
            <p className="text-sm"><span className="text-texto-suave">Cliente: </span><span className="font-medium text-texto">{hoja.cliente?.nombre}</span></p>
          ) : (
            <SelectorDeRegistro
              etiqueta="Cliente"
              valor={hoja.cliente}
              alCambiar={(o) => alCambiar({ cliente: o ? { id: o.id, nombre: o.nombre } : null })}
              buscar={buscarDeClientes}
              buscarSinTexto={clientesIniciales}
              error={errores.cliente}
              ayuda="Escribe el nombre y elige uno de la lista. Si no existe, créalo ahí mismo."
              textoSinResultados="Ningún cliente se parece a eso"
              alCrear={setNuevoCliente}
              textoCrear="Crear cliente"
            />
          )}
          {hoja.cliente ? <DatosDelCliente id={hoja.cliente.id} /> : null}
        </div>
        <Campo etiqueta="Referencia" maxLength={200} value={hoja.referencia} readOnly={soloLectura} ayuda="Opcional: a qué se refiere. Si la dejas vacía se usa la primera descripción." onChange={(e) => alCambiar({ referencia: e.target.value })} />
      </div>
    </section>
  );
}
