import { useState } from 'react';
import type { ArticuloDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { activarArticulo, buscarProductos, editarArticulo } from './api.ts';
import { argumentosDeActivar, argumentosDeEdicion, formularioDeArticulo, mensajeDeRechazo, validarArticulo, type ErroresDeArticulo, type FormularioDeArticulo } from './logica.ts';
import { refrescarInventario } from './use-inventario.ts';

type Props = {
  abierto: boolean;
  /** Con artículo, edita su mínimo y unidad; sin él, pone un producto bajo control. */
  articulo?: ArticuloDto;
  alCerrar: () => void;
  /** Tras poner un producto bajo control (por ejemplo, para abrir su ficha). */
  alActivar?: (id: string) => void;
};

function Contenido({ articulo, alCerrar, alActivar }: Omit<Props, 'abierto'>) {
  const [form, setForm] = useState<FormularioDeArticulo>(() => formularioDeArticulo(articulo));
  const [errores, setErrores] = useState<ErroresDeArticulo>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeArticulo>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const e = validarArticulo(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const edicion = articulo ? argumentosDeEdicion(articulo, form) : null;
    if (articulo && !edicion) return alCerrar();
    setGuardando(true);
    setFallo(undefined);
    const r = edicion ? await editarArticulo(edicion) : await activarArticulo(argumentosDeActivar(form));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      notificar(articulo ? 'Artículo actualizado.' : `${r.datos.nombre} ya está en el inventario.`, 'exito');
      await refrescarInventario();
      alCerrar();
      if (!articulo) alActivar?.(r.datos.id);
    } else if ('error' in r) {
      setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      {articulo ? (
        <p className="font-medium text-texto">{articulo.nombre}</p>
      ) : (
        <SelectorDeRegistro etiqueta="Producto" valor={form.producto} alCambiar={(producto) => cambiar({ producto })} buscar={buscarProductos} error={errores.producto} textoSinResultados="Ningún producto del catálogo se parece a eso" />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoCantidad etiqueta="Mínimo (opcional)" unidad={form.unidad || articulo?.unidad} valor={form.minimo} alCambiar={(minimo) => cambiar({ minimo })} ayuda="Por debajo de esta cantidad, el artículo aparece en «Bajo mínimo»." />
        <CampoUnidad textoVacio="La del producto" valor={form.unidad} alCambiar={(unidad) => cambiar({ unidad })} error={errores.unidad} />
      </div>
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{articulo ? 'Guardar' : 'Controlar en inventario'}</Boton>
      </div>
    </form>
  );
}

export function HojaDeArticulo({ abierto, articulo, alCerrar, alActivar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={articulo ? 'Mínimo y unidad' : 'Controlar un producto'}>
      {abierto ? <Contenido articulo={articulo} alCerrar={alCerrar} alActivar={alActivar} /> : null}
    </HojaInferior>
  );
}
