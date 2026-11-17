import { useState } from 'react';
import type { SolicitudDeCompraDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro, type Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { buscarProveedores } from './api.ts';
import { convertirSolicitud } from './api-operaciones.ts';
import { refrescarCompras } from './acciones.ts';
import { mensajeDeRechazo } from './logica.ts';

async function buscar(texto: string) {
  return datosOError(await buscarProveedores(texto)).items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}

function Contenido({ solicitud, alCerrar, alConvertir }: { solicitud: SolicitudDeCompraDto; alCerrar: () => void; alConvertir: (ordenId: string) => void }) {
  const [proveedor, setProveedor] = useState<Opcion | null>(null);
  const [entregaEl, setEntregaEl] = useState(solicitud.necesariaEl ?? '');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function convertir() {
    if (!proveedor) return setError('Elige el proveedor al que se le compra.');
    setEnviando(true);
    setError(undefined);
    const r = await convertirSolicitud({ id: solicitud.id, proveedorId: proveedor.id, ...(entregaEl && { entregaEl }) });
    setEnviando(false);
    if (r.ok && 'datos' in r && r.datos.ordenId) {
      notificar('Orden de compra creada en borrador: completa los costos y envíala.', 'exito');
      await refrescarCompras();
      alConvertir(r.datos.ordenId);
    } else if ('error' in r) setError(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void convertir(); }}>
      <p className="text-sm text-texto-suave">Se crea una orden de compra en borrador con las {solicitud.lineas.length} líneas de la solicitud. Los costos quedan en cero para que los completes en la orden.</p>
      <SelectorDeRegistro etiqueta="Proveedor" valor={proveedor} alCambiar={setProveedor} buscar={buscar} error={error} textoSinResultados="Ningún contacto se parece a eso" />
      <Campo etiqueta="Entrega esperada (opcional)" type="date" value={entregaEl} onChange={(e) => setEntregaEl(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando}>Crear orden de compra</Boton>
      </div>
    </form>
  );
}

/** Hoja «Convertir en orden de compra» de una solicitud aprobada. */
export function HojaDeConversion({ abierto, solicitud, alCerrar, alConvertir }: { abierto: boolean; solicitud: SolicitudDeCompraDto; alCerrar: () => void; alConvertir: (ordenId: string) => void }) {
  return <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Convertir en orden de compra">{abierto ? <Contenido solicitud={solicitud} alCerrar={alCerrar} alConvertir={alConvertir} /> : null}</HojaInferior>;
}
