import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { Candidata, ProductoDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha } from '../../shared/ui/datos/ficha.tsx';
import { useFicha } from '../../shared/ui/datos/use-ficha.ts';
import { EnlaceAlCotizador } from '../../shared/ui/enlace-al-cotizador.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { archivarProducto, datosOError, editarProducto, restaurarProducto, verProducto } from './api.ts';
import { CLAVE_PRODUCTOS } from './claves.ts';
import { FormularioProducto } from './formulario-producto.tsx';
import {
  argumentosDeEdicion,
  ETIQUETA_DE_TIPO,
  formatearPrecio,
  formularioDesde,
  mensajeDeRechazo,
  validarProducto,
  type ErroresDeProducto,
  type FormularioDeProducto,
} from './logica.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Lectura({ c }: { c: ProductoDto }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Tipo" valor={ETIQUETA_DE_TIPO[c.tipo]} />
      <Dato etiqueta="Código" valor={c.codigo ?? ''} />
      <Dato etiqueta="Precio unitario" valor={formatearPrecio(c.precioUnitarioMilesimas)} />
      <Dato etiqueta="Unidad" valor={c.unidad} />
      <Dato etiqueta="Afecto a IGV" valor={c.afectoIgv ? 'Sí' : 'No'} />
      <Dato etiqueta="Descripción" valor={c.descripcion ?? ''} />
      <Dato etiqueta="Última modificación" valor={formatearFechaHora(c.actualizadoEn)} />
    </dl>
  );
}

function Contenido({ producto }: { producto: ProductoDto }) {
  const yo = useYo();
  const consultas = useQueryClient();
  const { estado, enviar } = useFicha();
  const [form, setForm] = useState<FormularioDeProducto>(() => formularioDesde(producto));
  const [errores, setErrores] = useState<ErroresDeProducto>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const puedeEditar = !!yo && puede(yo, 'productos:editar');
  const archivado = producto.archivadoEn !== null;

  const refrescar = () => consultas.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });

  async function guardar() {
    const e = validarProducto(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const args = argumentosDeEdicion(producto, form);
    if (!args) {
      enviar('descartar');
      return;
    }
    enviar('guardar');
    setAviso(undefined);
    const r = await editarProducto(args);
    if (r.ok && 'datos' in r) {
      enviar('guardado');
      notificar('Producto actualizado.', 'exito');
      await refrescar();
      return;
    }
    enviar('fallo');
    if ('error' in r) {
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
      setCandidatas(r.error.candidatas ?? []);
    }
  }

  async function alternarArchivo() {
    if (!archivado && !(await confirmar('Archivar producto', `«${producto.nombre}» dejará de aparecer entre los activos. Se puede restaurar.`, { textoConfirmar: 'Archivar', peligroso: true }))) return;
    const r = await (archivado ? restaurarProducto(producto.id) : archivarProducto(producto.id));
    if (r.ok) {
      notificar(archivado ? 'Producto restaurado.' : 'Producto archivado.', 'exito');
      await refrescar();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={producto.nombre}
        migas={[{ texto: 'Productos', a: '/productos' }, { texto: producto.nombre }]}
        accionesSecundarias={
          <>
            {archivado ? <Insignia tono="neutro">Archivado</Insignia> : null}
            {puedeEditar ? <Boton variante={archivado ? 'secundario' : 'peligro'} onClick={() => void alternarArchivo()}>{archivado ? 'Restaurar' : 'Archivar'}</Boton> : null}
            <EnlaceAlCotizador productoId={producto.id} />
          </>
        }
      />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}{candidatas.length ? `: ${candidatas.map((c) => c.nombre).join(', ')}` : ''}</p> : null}
      <Ficha
        estado={estado}
        soloLectura={!puedeEditar || archivado}
        onEditar={() => {
          setForm(formularioDesde(producto));
          enviar('editar');
        }}
        onGuardar={() => void guardar()}
        onDescartar={() => {
          enviar('descartar');
          setErrores({});
          setAviso(undefined);
        }}
        secciones={[
          {
            id: 'datos',
            titulo: 'Datos del producto',
            lectura: <Lectura c={producto} />,
            edicion: (
              <FormularioProducto
                valor={form}
                errores={errores}
                alCambiar={(c) => {
                  setForm((f) => ({ ...f, ...c }));
                  enviar('cambio');
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

export function PantallaFichaProducto() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_PRODUCTOS, 'ficha', id], queryFn: async () => datosOError(await verProducto(id)) });
  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando producto" className="flex flex-col gap-2">
        <Esqueleto className="h-8 w-1/2" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  if (consulta.isError) {
    return <EstadoVacio titulo="No encontramos este producto" descripcion={consulta.error.message} icono="caja" />;
  }
  // `key` reinicia el estado de edición cuando los datos cambian por el servidor.
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}`} producto={consulta.data} />;
}
