import { useState } from 'react';
import { useNavigate } from 'react-router';
import { datosOError } from '../../../shared/api/consultas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../../shared/ui/selector-de-registro.tsx';
import { refrescarCotizador } from '../acciones.ts';
import { buscarClientes } from '../api.ts';
import { mensajeDeRechazo } from '../logica.ts';
import { SeccionesDelCotizador } from '../marco.tsx';
import { usePermisosDelCotizador } from '../use-cotizador.ts';
import { iniciarCuadro } from './api-cuadro.ts';
import { clientesIniciales } from '../clientes-iniciales.ts';
import { ETIQUETA_DE_PLANTILLA, argumentosDeInicio, type PlantillaDelCuadro } from './logica-cuadro-inicio.ts';
import { rutaDeCuadro } from './logica-cuadro.ts';

/** Empezar un cuadro por partes: elegir la plantilla y, si se quiere, el cliente. */
export function PantallaCuadroNuevo() {
  const navegar = useNavigate();
  const { editar } = usePermisosDelCotizador();
  const [plantilla, setPlantilla] = useState<PlantillaDelCuadro>('volantes');
  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [creando, setCreando] = useState(false);

  async function buscar(texto: string) {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }
  async function empezar() {
    setCreando(true);
    const r = await iniciarCuadro(argumentosDeInicio({ plantilla, titulo, clienteId: cliente?.id ?? null }));
    setCreando(false);
    if (r.ok && 'datos' in r) {
      await refrescarCotizador();
      void navegar(rutaDeCuadro(r.datos.cuadro.cotizacionId));
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Cotizar por partes" />
      <SeccionesDelCotizador />
      {editar ? (
        <form noValidate className="flex max-w-xl flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void empezar(); }}>
          <CampoSelect etiqueta="Plantilla" value={plantilla} ayuda="La plantilla deja listas las filas más comunes; después puedes cambiarlas." onChange={(e) => setPlantilla(e.target.value === 'en_blanco' ? 'en_blanco' : 'volantes')}>
            {(Object.keys(ETIQUETA_DE_PLANTILLA) as PlantillaDelCuadro[]).map((p) => <option key={p} value={p}>{ETIQUETA_DE_PLANTILLA[p]}</option>)}
          </CampoSelect>
          <Campo etiqueta="Título (opcional)" maxLength={200} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <SelectorDeRegistro etiqueta="Cliente (opcional)" valor={cliente} alCambiar={setCliente} buscar={buscar} buscarSinTexto={clientesIniciales} textoSinResultados="Ningún cliente se parece a eso" ayuda="Puedes ponerlo después." />
          <div className="flex justify-end"><Boton type="submit" variante="primario" cargando={creando}>Empezar el cuadro</Boton></div>
        </form>
      ) : <EstadoVacio titulo="No puedes crear cotizaciones" descripcion="Pide el permiso de edición del Cotizador." icono="caja" />}
    </div>
  );
}
