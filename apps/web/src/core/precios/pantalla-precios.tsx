import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { PrecioAnteriorDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { buscarClientes } from '../clientes/api.ts';
import { CLAVE_PRECIOS, consultarPrecioAnterior } from './api.ts';
import { argumentosDe, busquedaDe, leerDireccion, type Busqueda } from './logica.ts';
import { HistorialDePrecios, TarjetaDelUltimo } from './resultado-precios.tsx';

async function buscarDeClientes(texto: string): Promise<Opcion[]> {
  return datosOError(await buscarClientes(texto, 8)).items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}

function Resultado({ r, busqueda, alElegir }: { r: PrecioAnteriorDto; busqueda: Busqueda; alElegir: (o: Opcion) => void }) {
  const avisos = r.fuentesConsultadas.flatMap((f) => (f.aviso ? [f.aviso] : []));
  if (r.candidatosDeCliente.length > 0 || (busqueda.clienteTexto && !r.cliente)) {
    return (
      <section aria-label="Elige el cliente" className="flex flex-col gap-2">
        <p role="status" className="text-texto">{r.candidatosDeCliente.length > 0 ? `Hay varios clientes que se parecen a «${busqueda.clienteTexto}». ¿Cuál es?` : `No encontré un cliente que se llame «${busqueda.clienteTexto}».`}</p>
        <div className="flex flex-wrap gap-2">
          {r.candidatosDeCliente.map((c) => <Boton key={c.id} onClick={() => alElegir({ id: c.id, nombre: c.nombre })}>{c.nombre}</Boton>)}
        </div>
      </section>
    );
  }
  const hay = r.ultimo !== null || r.historial.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {r.cliente ? <p className="text-texto-suave">Cliente: <span className="font-medium text-texto">{r.cliente.nombre}</span></p> : <p className="text-texto-suave">Sin cliente: se buscó en los últimos 2 años.</p>}
      {r.ultimo ? <TarjetaDelUltimo f={r.ultimo} /> : null}
      <HistorialDePrecios filas={r.historial} conCliente={r.cliente !== null} />
      {hay ? null : <EstadoVacio titulo="No encontramos precios de eso" descripcion="Prueba con menos palabras o con otro nombre del producto." icono="buscar" />}
      {avisos.length > 0 ? <p role="status" className="text-sm text-texto-suave">Nota: {avisos.join('; ')}.</p> : null}
    </div>
  );
}

/** «¿Cuánto le cobramos?»: elige un cliente (opcional) y escribe el producto; muestra el último precio y las veces anteriores. */
export function PantallaPrecios() {
  const [params] = useSearchParams();
  const inicial = leerDireccion(params);
  const [cliente, setCliente] = useState<Opcion | null>(inicial.clienteId ? { id: inicial.clienteId, nombre: inicial.clienteNombre || 'Cliente' } : null);
  const [clienteTexto, setClienteTexto] = useState(inicial.clienteId ? '' : inicial.clienteTexto);
  const [texto, setTexto] = useState(inicial.texto);
  const [busqueda, setBusqueda] = useState<Busqueda | null>(() => busquedaDe({ clienteId: inicial.clienteId, clienteTexto: inicial.clienteTexto, texto: inicial.texto }));
  const consulta = useQuery({
    queryKey: [...CLAVE_PRECIOS, busqueda],
    enabled: busqueda !== null,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => datosOError(await consultarPrecioAnterior(argumentosDe(busqueda!))),
  });
  const faltaProducto = texto.trim().length < 2;

  function buscar() {
    setBusqueda(busquedaDe({ clienteId: cliente?.id, clienteTexto, texto }));
  }
  function elegirCandidato(o: Opcion) {
    setCliente(o);
    setClienteTexto('');
    setBusqueda(busquedaDe({ clienteId: o.id, texto }));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-8">
      <EncabezadoDePagina titulo="¿Cuánto le cobramos?" />
      <form noValidate className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
        {clienteTexto && !cliente ? (
          <div className="flex items-center justify-between gap-2 rounded-control border border-borde-fuerte bg-superficie-alta pl-3">
            <span className="min-w-0 truncate text-texto">Cliente buscado: «{clienteTexto}»</span>
            <Boton variante="fantasma" onClick={() => setClienteTexto('')}>Quitar</Boton>
          </div>
        ) : (
          <SelectorDeRegistro etiqueta="Cliente" valor={cliente} alCambiar={setCliente} buscar={buscarDeClientes} ayuda="Opcional. Sin cliente se busca en toda la empresa, los últimos 2 años." textoSinResultados="Ningún cliente se parece a eso" />
        )}
        <Campo etiqueta="Producto" value={texto} placeholder="Ejemplo: cajas de bocaditos" maxLength={300} autoComplete="off" onChange={(e) => setTexto(e.target.value)} ayuda="Como lo dirías: no hace falta el nombre exacto." />
        <Boton type="submit" variante="primario" icono="buscar" disabled={faltaProducto} cargando={consulta.isFetching}>Ver precios</Boton>
      </form>
      {busqueda === null ? null : consulta.isPending ? (
        <div aria-busy="true" aria-label="Buscando precios" className="flex flex-col gap-2"><Esqueleto className="h-32" /><Esqueleto className="h-20" /></div>
      ) : consulta.isError ? (
        <EstadoVacio titulo="No se pudo consultar" descripcion={consulta.error.message} icono="error" />
      ) : (
        <Resultado r={consulta.data} busqueda={busqueda} alElegir={elegirCandidato} />
      )}
    </div>
  );
}
