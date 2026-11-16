import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoCantidad } from '../../shared/ui/campo-cantidad.tsx';
import { CampoPrecio } from '../../shared/ui/campo-precio.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { SelectorDeRegistro } from '../../shared/ui/selector-de-registro.tsx';
import { buscarArticulos, moverExistencia } from './api.ts';
import {
  argumentosDeMovimiento, ETIQUETA_DE_TIPO, existenciaEn, formularioDeMovimiento, mensajeDeRechazo, siguienteFormulario, textoDeCantidad, validarMovimiento,
  type ErroresDeMovimiento, type FormularioDeMovimiento, type OpcionDeRegistro, type TipoManual,
} from './logica.ts';
import { refrescarInventario, useArticulo, useSucursales } from './use-inventario.ts';

type Props = {
  /** Abierta con este tipo; `null` la cierra. */
  tipo: TipoManual | null;
  /** Desde la ficha del artículo: el artículo viene fijo. */
  articulo?: OpcionDeRegistro;
  alCerrar: () => void;
};

function SelectorDeTipo({ tipo, alCambiar }: { tipo: TipoManual; alCambiar: (t: TipoManual) => void }) {
  return (
    <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-2">
      {(['entrada', 'salida'] as const).map((t) => (
        <Boton key={t} variante={tipo === t ? 'primario' : 'secundario'} aria-pressed={tipo === t} onClick={() => alCambiar(t)}>
          {ETIQUETA_DE_TIPO[t]}
        </Boton>
      ))}
    </div>
  );
}

type PropsDeCampos = {
  form: FormularioDeMovimiento;
  cambiar: (c: Partial<FormularioDeMovimiento>) => void;
  errores: ErroresDeMovimiento;
  fijo: OpcionDeRegistro | undefined;
  sucursalId: string;
  unidad: string | undefined;
  disponible: number | null;
  /** Cambia tras cada guardado: reinicia los campos de cantidad. */
  vuelta: number;
};

function Campos({ form, cambiar, errores, fijo, sucursalId, unidad, disponible, vuelta }: PropsDeCampos) {
  const sucursales = useSucursales();
  return (
    <>
      <SelectorDeTipo tipo={form.tipo} alCambiar={(t) => cambiar({ tipo: t, costo: null })} />
      {fijo ? (
        <p className="font-medium text-texto">{fijo.nombre}</p>
      ) : (
        <SelectorDeRegistro etiqueta="Artículo" valor={form.articulo} alCambiar={(a) => cambiar({ articulo: a })} buscar={buscarArticulos} error={errores.articulo} textoSinResultados="Ningún artículo controlado se parece a eso" />
      )}
      <CampoSelect etiqueta="Sucursal" value={sucursalId} onChange={(e) => cambiar({ sucursalId: e.target.value })} error={errores.sucursalId}>
        {(sucursales.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}
      </CampoSelect>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoCantidad
          key={`c${vuelta}`}
          autoFocus={!!fijo}
          etiqueta="Cantidad"
          unidad={unidad}
          valor={form.cantidad}
          alCambiar={(cantidad) => cambiar({ cantidad })}
          error={errores.cantidad}
          ayuda={disponible !== null ? `Hay ${textoDeCantidad(disponible, unidad)} en esta sucursal.` : undefined}
        />
        {form.tipo === 'entrada' ? (
          <CampoPrecio key={`p${vuelta}`} etiqueta="Costo unitario (opcional)" valor={form.costo} alCambiar={(costo) => cambiar({ costo })} />
        ) : null}
      </div>
      <Campo etiqueta="Motivo (opcional)" maxLength={300} value={form.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} error={errores.motivo} />
    </>
  );
}

/** Lo que quedó tras guardar: la primera línea en verde y, si quedó bajo el mínimo, el aviso. */
function Hecho({ lineas }: { lineas: string[] | undefined }) {
  if (!lineas) return null;
  return (
    <div role="status" className="flex flex-col gap-1 text-sm font-medium">
      <p className="text-exito">{lineas[0]}</p>
      {lineas[1] ? <p className="text-aviso">{lineas[1]}</p> : null}
    </div>
  );
}

function Contenido({ tipo, articulo: fijo, alCerrar }: Omit<Props, 'tipo'> & { tipo: TipoManual }) {
  const sucursales = useSucursales();
  const [form, setForm] = useState<FormularioDeMovimiento>(() => formularioDeMovimiento(tipo, fijo ?? null, ''));
  const [errores, setErrores] = useState<ErroresDeMovimiento>({});
  const [fallo, setFallo] = useState<string | undefined>();
  const [hecho, setHecho] = useState<string[] | undefined>();
  const [guardando, setGuardando] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const sucursalId = form.sucursalId || sucursales.data?.[0]?.id || '';
  const articulo = useArticulo(form.articulo?.id);
  const unidad = articulo.data?.unidad;
  const disponible = existenciaEn(articulo.data, sucursalId);
  const cambiar = (c: Partial<FormularioDeMovimiento>) => setForm((f) => ({ ...f, ...c }));

  async function guardar() {
    const completo = { ...form, sucursalId };
    const e = validarMovimiento(completo, disponible, unidad);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setGuardando(true);
    setFallo(undefined);
    const r = await moverExistencia(argumentosDeMovimiento(completo));
    setGuardando(false);
    if (r.ok && 'datos' in r) {
      await refrescarInventario();
      const { movimiento: m, existencia: x } = r.datos;
      setHecho([`${ETIQUETA_DE_TIPO[m.tipo]} de ${m.nombre}: quedan ${textoDeCantidad(x.cantidadMilesimas, x.unidad)} en ${x.sucursalNombre}.`, ...(x.bajoMinimo ? ['Quedó bajo el mínimo.'] : [])]);
      // La hoja queda abierta para el siguiente; la clave reinicia los campos de cantidad y le devuelve el foco.
      setForm(siguienteFormulario(completo, !!fijo));
      setVuelta((v) => v + 1);
    } else if ('error' in r) {
      setHecho(undefined);
      setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <Hecho lineas={hecho} />
      <Campos form={form} cambiar={cambiar} errores={errores} fijo={fijo} sucursalId={sucursalId} unidad={unidad} disponible={disponible} vuelta={vuelta} />
      {fallo ? <p role="alert" className="text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{form.tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}</Boton>
      </div>
    </form>
  );
}

/** Hoja «Entrada / Salida»: tipo, artículo, sucursal y cantidad; tras guardar queda abierta para el siguiente. */
export function HojaDeMovimiento({ tipo, articulo, alCerrar }: Props) {
  return (
    <HojaInferior abierto={tipo !== null} alCerrar={alCerrar} titulo="Entrada / Salida">
      {tipo ? <Contenido tipo={tipo} articulo={articulo} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
