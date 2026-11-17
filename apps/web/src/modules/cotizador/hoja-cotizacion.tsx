import { useState } from 'react';
import type { Centimos } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { resolverAccion } from './acciones.ts';
import { editarCotizacion } from './api-cotizaciones.ts';
import { buscarClientes, crearCotizacion } from './api.ts';
import { HojaLineaDeCotizacion } from './hoja-linea-cotizacion.tsx';
import {
  argumentosDeCreacion, argumentosDeEdicion, lineaVacia, validarFormulario,
  type ErroresDeFormulario, type FormularioDeCotizacion, type LineaDeFormulario,
} from './logica-cotizaciones.ts';

const COLUMNAS: Array<Columna<LineaDeFormulario>> = [
  { id: 'descripcion', titulo: 'Línea', principal: true, celda: (l) => l.descripcion || l.lista?.nombre || 'Línea sin descripción' },
  { id: 'cantidad', titulo: 'Cantidad', alinear: 'derecha', celda: (l) => (l.cantidadMilesimas === null ? '—' : formatearCantidad(l.cantidadMilesimas, l.unidad)) },
  { id: 'precio', titulo: 'Precio', alinear: 'derecha', celda: (l) => (l.tipo === 'lista' ? 'De la lista' : l.precioUnitarioMilesimas === null ? '—' : `S/ ${milesimasATexto(l.precioUnitarioMilesimas)}`) },
];

type Props = {
  abierto: boolean;
  /** Sin `id` se crea una cotización; con `id` se edita ese borrador. */
  id: string | null;
  inicial: FormularioDeCotizacion;
  puedeVerCostos: boolean;
  alGuardar: (id: string) => void;
  alCerrar: () => void;
};

function Contenido({ id, inicial, puedeVerCostos, alGuardar, alCerrar }: Omit<Props, 'abierto'>) {
  const [f, setF] = useState(inicial);
  const [errores, setErrores] = useState<ErroresDeFormulario>({});
  const [guardando, setGuardando] = useState(false);
  const [abierta, setAbierta] = useState<{ linea: LineaDeFormulario; esNueva: boolean } | null>(null);
  const poner = <K extends keyof FormularioDeCotizacion>(k: K, v: FormularioDeCotizacion[K]) => setF((a) => ({ ...a, [k]: v }));

  async function buscar(texto: string) {
    const { items } = datosOError(await buscarClientes(texto));
    return items.map((c) => ({ id: c.id, nombre: c.nombre }));
  }
  async function guardar() {
    const e = validarFormulario(f);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    const r = id ? await editarCotizacion(argumentosDeEdicion(id, f, puedeVerCostos)) : await crearCotizacion(argumentosDeCreacion(f));
    const ok = await resolverAccion(r, id ? 'Cambios guardados.' : 'Cotización creada como borrador.');
    setGuardando(false);
    if (ok && 'datos' in r && r.ok) alGuardar(r.datos.id);
  }
  function guardarLinea(l: LineaDeFormulario) {
    if (!abierta) return;
    poner('lineas', abierta.esNueva ? [...f.lineas, l] : f.lineas.map((x) => (x.clave === l.clave ? l : x)));
    setAbierta(null);
  }

  return (
    <>
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Título" maxLength={200} value={f.titulo} error={errores.titulo} ayuda="Para reconocerla en la lista, por ejemplo «Volantes para la feria»." onChange={(e) => poner('titulo', e.target.value)} />
      <SelectorDeRegistro etiqueta="Cliente" valor={f.cliente} alCambiar={(o) => poner('cliente', o)} buscar={buscar} ayuda="Hace falta para emitirla." textoSinResultados="Ningún cliente se parece a eso" />
      <section aria-label="Líneas de la cotización" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-titulo font-semibold text-texto">Líneas</h3>
          <Boton icono="mas" onClick={() => setAbierta({ linea: lineaVacia(crypto.randomUUID()), esNueva: true })}>Agregar línea</Boton>
        </div>
        <Lista
          etiqueta="Líneas de la cotización"
          columnas={COLUMNAS}
          filas={f.lineas}
          clave={(l) => l.clave}
          onAbrir={(l) => setAbierta({ linea: l, esNueva: false })}
          vacio={<EstadoVacio titulo="Sin líneas todavía" descripcion="Agrega lo que vas a cotizar." icono="caja" />}
        />
        {errores.lineas ? <p role="alert" className="text-sm font-medium text-peligro">{errores.lineas}</p> : null}
        <p className="text-sm text-texto-suave">Los precios y totales los calcula el sistema al guardar.</p>
      </section>
      <CampoSelect etiqueta="Las líneas son" value={f.conOpciones ? 'opciones' : 'juntas'} onChange={(e) => poner('conOpciones', e.target.value === 'opciones')}>
        <option value="juntas">Un solo trabajo (se suman)</option>
        <option value="opciones">Opciones para elegir (no se suman)</option>
      </CampoSelect>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-titulo font-semibold text-texto">Condiciones</legend>
        <p className="text-sm text-texto-suave">Lo que dejes vacío se completa con las condiciones de tus Ajustes al emitir.</p>
        <Campo etiqueta="Validez en días" inputMode="numeric" value={f.validezDias} error={errores.validezDias} onChange={(e) => poner('validezDias', e.target.value)} />
        <Campo etiqueta="Plazo de entrega" maxLength={300} value={f.plazoEntrega} onChange={(e) => poner('plazoEntrega', e.target.value)} />
        <Campo etiqueta="Forma de pago" maxLength={300} value={f.formaPago} onChange={(e) => poner('formaPago', e.target.value)} />
        <Campo etiqueta="Tolerancia" maxLength={300} value={f.tolerancia} onChange={(e) => poner('tolerancia', e.target.value)} />
        <Campo etiqueta="Lo que no incluye" maxLength={300} value={f.noIncluye} onChange={(e) => poner('noIncluye', e.target.value)} />
      </fieldset>
      <CampoTextarea etiqueta="Notas (opcional)" filas={2} maxLength={1000} value={f.notas} onChange={(e) => poner('notas', e.target.value)} />
      {puedeVerCostos ? <CampoMonto etiqueta="Costo (opcional)" valor={f.costo} ayuda="Solo lo ves tú. Sirve para calcular el margen." alCambiar={(v: Centimos | null) => poner('costo', v)} /> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{id ? 'Guardar cambios' : 'Crear borrador'}</Boton>
      </div>
    </form>
      <HojaLineaDeCotizacion
        linea={abierta?.linea ?? null}
        esNueva={abierta?.esNueva ?? true}
        clienteId={f.cliente?.id ?? null}
        alGuardar={guardarLinea}
        alQuitar={() => { if (abierta) poner('lineas', f.lineas.filter((x) => x.clave !== abierta.linea.clave)); setAbierta(null); }}
        alCerrar={() => setAbierta(null)}
      />
    </>
  );
}

/** Crear o editar una cotización en borrador. El formulario se reinicia en cada apertura. */
export function HojaDeCotizacion({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={resto.id ? 'Editar cotización' : 'Nueva cotización'}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
