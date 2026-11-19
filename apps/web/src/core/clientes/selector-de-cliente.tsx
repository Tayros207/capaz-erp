import { useState } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import type { Opcion } from '../../shared/ui/logica-selector.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarClientes, primerosClientes } from './api.ts';
import { HojaNuevoCliente } from './hoja-nuevo-cliente.tsx';
import { ayudaDelSelectorDeCliente, opcionDeCliente, puedeCrearClientes } from './logica-selector-de-cliente.ts';

const POR_BUSQUEDA = 8;

async function buscar(texto: string) {
  return datosOError(await buscarClientes(texto, POR_BUSQUEDA)).items.map(opcionDeCliente);
}
async function primeros() {
  return datosOError(await primerosClientes()).items.map(opcionDeCliente);
}

type Props = { etiqueta?: string; valor: Opcion | null; alCambiar: (o: Opcion | null) => void; error?: string; ayuda?: string };

/** Selector de cliente con alta en el sitio: si no existe, «Nuevo cliente» abre la hoja con lo escrito y el creado queda elegido. */
export function SelectorDeCliente({ etiqueta = 'Cliente', valor, alCambiar, error, ayuda }: Props) {
  const puedeCrear = puedeCrearClientes(useYo());
  const [nombreNuevo, setNombreNuevo] = useState<string | null>(null);
  const elegir = (o: Opcion) => {
    setNombreNuevo(null);
    alCambiar(o);
  };
  return (
    <>
      {puedeCrear ? (
        <HojaNuevoCliente compacto abierto={nombreNuevo !== null} nombreInicial={nombreNuevo ?? ''} alCerrar={() => setNombreNuevo(null)} alCrear={(_id, o) => elegir(o)} alAbrirExistente={(_id, o) => elegir(o)} />
      ) : null}
      <SelectorDeRegistro
        etiqueta={etiqueta}
        valor={valor}
        alCambiar={alCambiar}
        buscar={buscar}
        buscarSinTexto={primeros}
        error={error}
        ayuda={ayuda ?? ayudaDelSelectorDeCliente(puedeCrear)}
        textoSinResultados="Ningún cliente se parece a eso"
        {...(puedeCrear && { alCrear: setNombreNuevo, textoCrear: 'Crear cliente', botonCrear: 'Nuevo cliente' })}
      />
    </>
  );
}
