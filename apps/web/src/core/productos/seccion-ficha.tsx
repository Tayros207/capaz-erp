import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProductoFichaDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import { guardarCategoria, guardarFicha, listarCategorias, verFicha } from './api-ampliados.ts';
import { datosOError } from '../clientes/api.ts';
import { CLAVE_PRODUCTOS } from './claves.ts';
import { numeroOpcional } from './logica-ampliados.ts';

type Formulario = {
  categoriaId: string;
  marca: string;
  sku: string;
  codigoBarras: string;
  costo: number | null;
  peso: string;
  alto: string;
  ancho: string;
  largo: string;
  vendible: boolean;
  comprable: boolean;
};

const texto = (n: number | null) => (n === null ? '' : String(n));
const desde = (f: ProductoFichaDto): Formulario => ({
  categoriaId: f.categoriaId ?? '',
  marca: f.marca ?? '',
  sku: f.sku ?? '',
  codigoBarras: f.codigoBarras ?? '',
  costo: f.costoMilesimas,
  peso: texto(f.pesoGramos),
  alto: texto(f.altoMm),
  ancho: texto(f.anchoMm),
  largo: texto(f.largoMm),
  vendible: f.vendible,
  comprable: f.comprable,
});

const vacioANulo = (t: string) => (t.trim() === '' ? null : t.trim());

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function FormularioFicha({ inicial, alGuardar, alCancelar }: { inicial: ProductoFichaDto; alGuardar: (f: Formulario) => Promise<void>; alCancelar: () => void }) {
  const consultas = useQueryClient();
  const categorias = useQuery({ queryKey: [...CLAVE_PRODUCTOS, 'categorias'], queryFn: async () => datosOError(await listarCategorias()).items });
  const [f, setF] = useState(() => desde(inicial));
  const [nueva, setNueva] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (c: Partial<Formulario>) => setF((x) => ({ ...x, ...c }));
  const errores = {
    peso: (() => { const r = numeroOpcional(f.peso, false); return r.ok ? undefined : r.error; })(),
    alto: (() => { const r = numeroOpcional(f.alto, true); return r.ok ? undefined : r.error; })(),
    ancho: (() => { const r = numeroOpcional(f.ancho, true); return r.ok ? undefined : r.error; })(),
    largo: (() => { const r = numeroOpcional(f.largo, true); return r.ok ? undefined : r.error; })(),
  };
  const hayError = Object.values(errores).some(Boolean);

  async function crearCategoria() {
    if (!nueva.trim()) return;
    const r = await guardarCategoria({ nombre: nueva });
    if (r.ok && 'datos' in r) {
      setNueva('');
      await consultas.invalidateQueries({ queryKey: [...CLAVE_PRODUCTOS, 'categorias'] });
      cambiar({ categoriaId: r.datos.id });
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (hayError) return;
        setOcupado(true);
        await alGuardar(f);
        setOcupado(false);
      }}
    >
      <CampoSelect etiqueta="Categoría" value={f.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
        <option value="">Sin categoría</option>
        {categorias.data?.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </CampoSelect>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1"><Campo etiqueta="Nueva categoría" value={nueva} onChange={(e) => setNueva(e.target.value)} /></div>
        <Boton onClick={() => void crearCategoria()} disabled={!nueva.trim()}>Crear</Boton>
      </div>
      <Campo etiqueta="Marca" value={f.marca} onChange={(e) => cambiar({ marca: e.target.value })} />
      <Campo etiqueta="SKU" value={f.sku} onChange={(e) => cambiar({ sku: e.target.value })} />
      <Campo etiqueta="Código de barras" inputMode="numeric" value={f.codigoBarras} onChange={(e) => cambiar({ codigoBarras: e.target.value })} />
      <CampoPrecio etiqueta="Costo" valor={f.costo} alCambiar={(costo) => cambiar({ costo })} />
      <Campo etiqueta="Peso (gramos)" inputMode="decimal" value={f.peso} error={errores.peso} onChange={(e) => cambiar({ peso: e.target.value })} />
      <Campo etiqueta="Alto (mm)" inputMode="numeric" value={f.alto} error={errores.alto} onChange={(e) => cambiar({ alto: e.target.value })} />
      <Campo etiqueta="Ancho (mm)" inputMode="numeric" value={f.ancho} error={errores.ancho} onChange={(e) => cambiar({ ancho: e.target.value })} />
      <Campo etiqueta="Largo (mm)" inputMode="numeric" value={f.largo} error={errores.largo} onChange={(e) => cambiar({ largo: e.target.value })} />
      <div className="flex flex-col justify-center gap-2 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.vendible} onChange={(e) => cambiar({ vendible: e.target.checked })} /> Se puede vender</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.comprable} onChange={(e) => cambiar({ comprable: e.target.checked })} /> Se puede comprar</label>
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Boton type="submit" variante="primario" cargando={ocupado}>Guardar</Boton>
        <Boton onClick={alCancelar}>Cancelar</Boton>
      </div>
    </form>
  );
}

/** Datos de catálogo y logística de un producto: categoría, marca, SKU, código de barras, costo y medidas. */
export function SeccionFicha({ productoId, puedeEditar }: { productoId: string; puedeEditar: boolean }) {
  const consultas = useQueryClient();
  const clave = [...CLAVE_PRODUCTOS, 'ficha-catalogo', productoId];
  const consulta = useQuery({ queryKey: clave, queryFn: async () => datosOError(await verFicha(productoId)) });
  const [editando, setEditando] = useState(false);
  if (consulta.isPending) return <Esqueleto className="h-24" />;
  if (consulta.isError) return <p role="alert" className="text-sm text-peligro">{consulta.error.message}</p>;
  const p = consulta.data;

  async function guardar(f: Formulario) {
    const peso = numeroOpcional(f.peso, false);
    const alto = numeroOpcional(f.alto, true);
    const ancho = numeroOpcional(f.ancho, true);
    const largo = numeroOpcional(f.largo, true);
    if (!peso.ok || !alto.ok || !ancho.ok || !largo.ok) return;
    const r = await guardarFicha({
      productoId,
      categoriaId: f.categoriaId || null,
      marca: vacioANulo(f.marca),
      sku: vacioANulo(f.sku),
      codigoBarras: vacioANulo(f.codigoBarras),
      costoMilesimas: f.costo,
      pesoGramos: peso.valor,
      altoMm: alto.valor,
      anchoMm: ancho.valor,
      largoMm: largo.valor,
      vendible: f.vendible,
      comprable: f.comprable,
    });
    if (r.ok && 'datos' in r) {
      notificar('Ficha guardada.', 'exito');
      setEditando(false);
      await consultas.invalidateQueries({ queryKey: clave });
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (editando) return <FormularioFicha inicial={p} alGuardar={guardar} alCancelar={() => setEditando(false)} />;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Categoría" valor={p.categoriaNombre ?? ''} />
        <Dato etiqueta="Marca" valor={p.marca ?? ''} />
        <Dato etiqueta="SKU" valor={p.sku ?? ''} />
        <Dato etiqueta="Código de barras" valor={p.codigoBarras ?? ''} />
        <Dato etiqueta="Costo" valor={p.costoMilesimas === null ? '' : `S/ ${milesimasATexto(p.costoMilesimas)}`} />
        <Dato etiqueta="Peso" valor={p.pesoGramos === null ? '' : `${p.pesoGramos} g`} />
        <Dato etiqueta="Medidas (alto × ancho × largo)" valor={p.altoMm === null && p.anchoMm === null && p.largoMm === null ? '' : `${p.altoMm ?? '—'} × ${p.anchoMm ?? '—'} × ${p.largoMm ?? '—'} mm`} />
        <Dato etiqueta="Uso" valor={[p.vendible ? 'Se vende' : 'No se vende', p.comprable ? 'Se compra' : 'No se compra'].join(' · ')} />
      </dl>
      {puedeEditar ? <div><Boton onClick={() => setEditando(true)}>Editar ficha</Boton></div> : null}
    </div>
  );
}

