import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ListaDePrecioDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { useRetardo } from '../../shared/ui/use-retardo.ts';
import { consultarPrecio, listarListas } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { soles } from './logica.ts';
import { validarLinea, type ErroresDeLinea, type LineaDeFormulario } from './logica-cotizaciones.ts';

type Props = { linea: LineaDeFormulario; esNueva: boolean; clienteId: string | null; alGuardar: (l: LineaDeFormulario) => void; alQuitar: () => void; alCerrar: () => void };

/** El precio de una línea de lista lo calcula el servidor (`precio_consultar`); aquí solo se muestra. */
function PrecioDeLista({ l, clienteId }: { l: LineaDeFormulario; clienteId: string | null }) {
  const cantidad = useRetardo(l.cantidadMilesimas);
  const listo = l.lista !== null && cantidad !== null && cantidad === l.cantidadMilesimas && cantidad > 0;
  const q = useQuery({
    queryKey: [...CLAVE_COTIZADOR, 'precio-linea', l.lista?.id, clienteId, cantidad],
    queryFn: async () => datosOError(await consultarPrecio({ listaId: l.lista?.id ?? '', cantidadMilesimas: cantidad ?? 0, ...(clienteId && { clienteId }), ajuste: { tipo: 'ninguno' } })),
    enabled: listo,
    retry: false,
  });
  if (!listo) return null;
  if (q.isPending) return <p role="status" className="text-texto-suave">Calculando…</p>;
  if (q.isError) return <p role="alert" className="text-sm font-medium text-peligro">{q.error.message}</p>;
  return (
    <GrupoDeCifras etiqueta="Precio de esta línea">
      <Cifra etiqueta="Precio (sin IGV)" valor={soles(q.data.importeCentimos)} ayuda={`Cada ${q.data.unidad}: S/ ${milesimasATexto(q.data.precioUnitarioMilesimas)}`} />
      <Cifra etiqueta={`Total con IGV (${q.data.igvPorcentaje} %)`} valor={soles(q.data.totalCentimos)} />
    </GrupoDeCifras>
  );
}

function Contenido({ linea, esNueva, clienteId, alGuardar, alQuitar, alCerrar }: Props) {
  const [l, setL] = useState(linea);
  const [errores, setErrores] = useState<ErroresDeLinea>({});
  const encontradas = useRef(new Map<string, ListaDePrecioDto>());

  async function buscar(texto: string) {
    const { items } = datosOError(await listarListas({ estado: 'activas', soloPorRevisar: false, buscar: texto }, undefined, 8));
    for (const x of items) encontradas.current.set(x.id, x);
    return items.map((x) => ({ id: x.id, nombre: x.nombre, detalle: `por ${x.unidad}` }));
  }
  function guardar() {
    const e = validarLinea(l);
    setErrores(e);
    if (Object.keys(e).length === 0) alGuardar(l);
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); guardar(); }}>
      <CampoSelect etiqueta="De dónde sale el precio" value={l.tipo} disabled={!esNueva} onChange={(e) => setL((a) => ({ ...a, tipo: e.target.value as 'lista' | 'manual' }))}>
        <option value="lista">De mi lista de precios</option>
        <option value="manual">Escribo el precio yo</option>
      </CampoSelect>
      {l.tipo === 'lista' ? (
        <>
          <SelectorDeRegistro
            etiqueta="Producto"
            valor={l.lista}
            alCambiar={(o) => setL((a) => ({ ...a, lista: o, unidad: o ? (encontradas.current.get(o.id)?.unidad ?? a.unidad) : a.unidad }))}
            buscar={buscar}
            error={errores.lista}
            textoSinResultados="Ningún producto de tu lista se parece a eso"
          />
          <Campo etiqueta="Descripción (opcional)" maxLength={300} value={l.descripcion} ayuda="Si la dejas vacía se usa el nombre del producto." onChange={(e) => setL((a) => ({ ...a, descripcion: e.target.value }))} />
        </>
      ) : (
        <Campo etiqueta="Descripción" maxLength={300} value={l.descripcion} error={errores.descripcion} onChange={(e) => setL((a) => ({ ...a, descripcion: e.target.value }))} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoCantidad etiqueta="Cantidad" valor={l.cantidadMilesimas} unidad={l.unidad} error={errores.cantidad} alCambiar={(v) => setL((a) => ({ ...a, cantidadMilesimas: v }))} />
        {l.tipo === 'manual' ? (
          <>
            <Campo etiqueta="Unidad" maxLength={20} value={l.unidad} onChange={(e) => setL((a) => ({ ...a, unidad: e.target.value }))} />
            <CampoPrecio etiqueta="Precio unitario" valor={l.precioUnitarioMilesimas} error={errores.precio} ayuda="Sin IGV." alCambiar={(v) => setL((a) => ({ ...a, precioUnitarioMilesimas: v }))} />
          </>
        ) : null}
      </div>
      {l.tipo === 'lista' ? <PrecioDeLista l={l} clienteId={clienteId} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {esNueva ? null : <Boton variante="peligro" onClick={alQuitar}>Quitar línea</Boton>}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario">{esNueva ? 'Agregar línea' : 'Guardar línea'}</Boton>
      </div>
    </form>
  );
}

/** Hoja para agregar o cambiar una línea. `linea` nula = cerrada. */
export function HojaLineaDeCotizacion({ linea, ...resto }: Omit<Props, 'linea'> & { linea: LineaDeFormulario | null }) {
  return (
    <HojaInferior abierto={linea !== null} alCerrar={resto.alCerrar} titulo={resto.esNueva ? 'Nueva línea' : 'Editar línea'}>
      {linea ? <Contenido key={linea.clave} linea={linea} {...resto} /> : null}
    </HojaInferior>
  );
}
