import { useRef, useState } from 'react';
import type { ListaDePrecioDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { datosOError } from '../../shared/api/consultas.ts';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoUnidad } from '../../shared/ui/campo-unidad.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCotizador } from './acciones.ts';
import { buscarProductosDelCatalogo, crearLista, editarLista } from './api.ts';
import {
  ETIQUETA_DE_MODO, LISTA_VACIA, REFERENCIAS, argumentosDeCreacionDeLista, argumentosDeEdicionDeLista, formularioDeLista, mensajeDeRechazo,
  pideConfirmarUnitario, unitarioDeReferencia, validarLista, type ErroresDeLista, type FormularioDeLista, type ModoIntermedio,
} from './logica.ts';
import type { ProductoParaLista } from './logica-catalogo.ts';
import { useUnidadesDeLaEmpresa } from './use-unidades.ts';

type Props = {
  abierto: boolean;
  lista: ListaDePrecioDto | null;
  /** Para una lista nueva: el producto del catálogo con que empieza (nombre y unidad ya puestos). */
  producto?: ProductoParaLista | null;
  /** Se llama con la lista guardada (creada o editada). */
  alGuardar?: (lista: ListaDePrecioDto) => void;
  alCerrar: () => void;
};

const formularioInicial = (lista: ListaDePrecioDto | null, producto: ProductoParaLista | null | undefined): FormularioDeLista =>
  lista ? formularioDeLista(lista) : producto ? { ...LISTA_VACIA, producto: { id: producto.id, nombre: producto.nombre }, nombre: producto.nombre, unidad: producto.unidad } : LISTA_VACIA;

function Contenido({ lista, producto, alGuardar, alCerrar }: Omit<Props, 'abierto'>) {
  const unidadesDeLaEmpresa = useUnidadesDeLaEmpresa();
  const [f, setF] = useState<FormularioDeLista>(() => formularioInicial(lista, producto));
  const [errores, setErrores] = useState<ErroresDeLista>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [confirmar, setConfirmar] = useState(false);
  const [pideConfirmar, setPideConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const unidades = useRef(new Map<string, string>());
  async function buscarEnCatalogo(texto: string) {
    const { items } = datosOError(await buscarProductosDelCatalogo(texto, 8));
    for (const p of items) unidades.current.set(p.id, p.unidad);
    return items.map((p) => ({ id: p.id, nombre: p.nombre, detalle: `por ${p.unidad}` }));
  }

  async function guardar() {
    const e = validarLista(f);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setAviso(undefined);
    let r;
    if (lista) {
      const args = argumentosDeEdicionDeLista(lista, f, confirmar);
      if (!args) {
        notificar('No cambiaste nada.', 'info');
        alCerrar();
        return;
      }
      setGuardando(true);
      r = await editarLista(args);
    } else {
      setGuardando(true);
      r = await crearLista(argumentosDeCreacionDeLista(f, confirmar));
    }
    setGuardando(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      notificar(lista ? 'Lista actualizada.' : 'Lista creada.', 'exito');
      await refrescarCotizador();
      alGuardar?.(r.datos);
      alCerrar();
    } else if ('error' in r) {
      setPideConfirmar(pideConfirmarUnitario(r.error.codigo, r.error.mensaje));
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <SelectorDeRegistro
        etiqueta="Producto del catálogo (opcional)"
        valor={f.producto}
        alCambiar={(o) => setF((a) => ({ ...a, producto: o ? { id: o.id, nombre: o.nombre } : null, ...(o && { nombre: a.nombre.trim() === '' || a.nombre === a.producto?.nombre ? o.nombre : a.nombre, unidad: unidades.current.get(o.id) ?? a.unidad }) }))}
        buscar={buscarEnCatalogo}
        ayuda="Enlaza esta lista a un producto de tu catálogo. Un producto tiene una sola lista activa."
        textoSinResultados="Ningún producto se parece a eso"
      />
      <Campo etiqueta="Nombre" autoFocus maxLength={120} value={f.nombre} error={errores.nombre} onChange={(e) => setF((a) => ({ ...a, nombre: e.target.value }))} />
      <CampoUnidad unidadesDeLaEmpresa={unidadesDeLaEmpresa} valor={f.unidad} error={errores.unidad} alCambiar={(u) => setF((a) => ({ ...a, unidad: u }))} />
      <p className="text-sm text-texto-suave">Escribe el precio total, sin IGV, de cada cantidad. Al lado ves lo que sale por unidad.</p>
      {REFERENCIAS.map((r) => (
        <div key={r.clave} className="grid grid-cols-[1fr_auto] items-end gap-3">
          <CampoMonto etiqueta={`Precio de ${r.etiqueta}`} valor={f[r.clave]} error={errores[r.clave]} alCambiar={(v) => setF((a) => ({ ...a, [r.clave]: v }))} />
          <p className="min-h-(--alto-control) pb-2 text-sm tabular-nums text-texto-suave" aria-label={`Por unidad con ${r.etiqueta}`}>
            <span className="block">Por unidad</span>
            <span className="font-medium text-texto">{unitarioDeReferencia(f[r.clave], r.cantidad)}</span>
          </p>
        </div>
      ))}
      <CampoSelect etiqueta="Entre una cantidad y otra" value={f.modo} onChange={(e) => setF((a) => ({ ...a, modo: e.target.value as ModoIntermedio }))}>
        {(Object.keys(ETIQUETA_DE_MODO) as ModoIntermedio[]).map((m) => <option key={m} value={m}>{ETIQUETA_DE_MODO[m]}</option>)}
      </CampoSelect>
      <CampoMonto etiqueta="Precio mínimo (opcional)" valor={f.minimo} error={errores.minimo} ayuda="Ninguna cotización de esta lista baja de este precio." alCambiar={(v) => setF((a) => ({ ...a, minimo: v }))} />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {pideConfirmar ? (
        <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
          <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="size-5 cursor-pointer accent-accion" />
          <span className="font-medium text-texto">Guardar igual, estoy de acuerdo</span>
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando} disabled={pideConfirmar && !confirmar}>{lista ? 'Guardar cambios' : 'Crear lista'}</Boton>
      </div>
    </form>
  );
}

/** Alta o edición de una lista de precios con sus tres precios de referencia. */
export function HojaDeLista({ abierto, lista, producto, alGuardar, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={lista ? 'Editar lista de precios' : 'Nueva lista de precios'}>
      {abierto ? <Contenido key={lista?.id ?? producto?.id ?? 'nueva'} lista={lista} producto={producto} alGuardar={alGuardar} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
