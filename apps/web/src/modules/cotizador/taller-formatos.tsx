import { useState } from 'react';
import type { FormatoDePliegoDto } from '@capaz/shared';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { archivarFormato, crearFormato, editarFormato, listarFormatos, restaurarFormato } from './api-taller.ts';
import {
  FORMATO_VACIO, TIPOS_DE_FORMATO, nombreDeCopia, argumentosDeCreacionDeFormato, argumentosDeEdicionDeFormato, etiquetaDeTipo, formularioDeFormato, medidasDe, validarFormato,
  type ErroresDeFormato, type FormularioDeFormato, type TipoDeFormato,
} from './logica-taller.ts';
import { guardarEnTaller } from './taller-guardar.ts';
import { PieDeHoja } from './taller-hoja-pie.tsx';
import { PanelDelTaller } from './taller-panel.tsx';

type Hoja = { formato: FormatoDePliegoDto | null; copiaDe?: FormatoDePliegoDto };
const formularioInicial = (h: Hoja): FormularioDeFormato =>
  h.formato ? formularioDeFormato(h.formato) : h.copiaDe ? { ...formularioDeFormato(h.copiaDe), nombre: nombreDeCopia(h.copiaDe.nombre, 60) } : FORMATO_VACIO;

function Contenido({ hoja, alCerrar }: { hoja: Hoja; alCerrar: () => void }) {
  const formato = hoja.formato;
  const [f, setF] = useState<FormularioDeFormato>(() => formularioInicial(hoja));
  const [errores, setErrores] = useState<ErroresDeFormato>({});
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof FormularioDeFormato>(k: K, v: FormularioDeFormato[K]) => setF((a) => ({ ...a, [k]: v }));

  async function guardar() {
    const cerrar = await guardarEnTaller(
      { formulario: f, original: formato, validar: validarFormato, alErrores: setErrores, armarCreacion: argumentosDeCreacionDeFormato, armarEdicion: argumentosDeEdicionDeFormato, crear: crearFormato, editar: editarFormato, mensajes: { creado: 'Formato creado.', editado: 'Formato actualizado.' } },
      () => setGuardando(true),
      () => setGuardando(false),
    );
    if (cerrar) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={60} value={f.nombre} error={errores.nombre} onChange={(e) => poner('nombre', e.target.value)} />
      <CampoSelect etiqueta="Tipo" value={f.tipo} onChange={(e) => poner('tipo', e.target.value as TipoDeFormato)}>
        {TIPOS_DE_FORMATO.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
      </CampoSelect>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Ancho (cm)" inputMode="decimal" autoComplete="off" value={f.anchoCm} error={errores.anchoCm} onChange={(e) => poner('anchoCm', e.target.value)} />
        <Campo etiqueta="Alto (cm)" inputMode="decimal" autoComplete="off" value={f.altoCm} error={errores.altoCm} onChange={(e) => poner('altoCm', e.target.value)} />
      </div>
      <PieDeHoja alCerrar={alCerrar} guardando={guardando} etiqueta={formato ? 'Guardar cambios' : 'Crear formato'} />
    </form>
  );
}

function HojaDeFormato({ hoja, alCerrar }: { hoja: Hoja | null; alCerrar: () => void }) {
  return (
    <HojaInferior abierto={hoja !== null} alCerrar={alCerrar} titulo={hoja?.formato ? 'Editar formato de pliego' : 'Nuevo formato de pliego'}>
      {hoja ? <Contenido key={hoja.formato?.id ?? `nuevo-${hoja.copiaDe?.id ?? ''}`} hoja={hoja} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}

const columnas: Array<Columna<FormatoDePliegoDto>> = [
  { id: 'nombre', titulo: 'Formato', principal: true, celda: (f) => f.nombre },
  { id: 'medidas', titulo: 'Medidas', celda: (f) => medidasDe(f.anchoCm, f.altoCm) },
  { id: 'tipo', titulo: 'Tipo', celda: (f) => etiquetaDeTipo(f.tipo).replace(/ \(.*\)$/, '') },
];

/** Formatos de pliego: el pliego madre que se compra y el tamaño de máquina al que se corta. */
export function PanelDeFormatos({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const [hoja, setHoja] = useState<Hoja | null>(null);
  return (
    <>
      <PanelDelTaller<FormatoDePliegoDto>
        clave="formatos"
        etiqueta="formatos de pliego"
        puedeConfigurar={puedeConfigurar}
        columnas={columnas}
        textoNuevo="Nuevo formato"
        vacioTitulo="Todavía no hay formatos"
        vacioDescripcion="Registra los pliegos que compras (madre) y los tamaños a los que los cortas para imprimir."
        cargar={async (estado, buscar, cursor) => listarFormatos({ estado, ...(buscar !== '' && { buscar }) }, cursor)}
        onNuevo={() => setHoja({ formato: null })}
        onEditar={(f) => setHoja({ formato: f })}
        onDuplicar={(f) => setHoja({ formato: null, copiaDe: f })}
        archivar={archivarFormato}
        restaurar={restaurarFormato}
      />
      <HojaDeFormato hoja={hoja} alCerrar={() => setHoja(null)} />
    </>
  );
}
