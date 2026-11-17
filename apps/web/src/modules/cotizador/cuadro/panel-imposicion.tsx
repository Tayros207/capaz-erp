import { useState } from 'react';
import type { FormatoDePliegoDto } from '@capaz/shared';
import { datosOError } from '../../../shared/api/consultas.ts';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { SelectorDeRegistro, type Opcion } from '../../../shared/ui/selector-de-registro.tsx';
import { listarFormatos, listarMaquinas } from '../api-taller.ts';
import { medidasDe, mostrarDecimal } from '../logica-taller.ts';
import { fijarImposicion } from './api-cuadro.ts';
import { CampoAlSalir } from './campo-al-salir.tsx';
import { avisosDeImposicion, filaDePapel } from './logica-cuadro.ts';
import { cambioDeMedida, textoDeDimensiones, type CampoDeMedida } from './logica-cuadro-filas.ts';
import { Seccion } from './seccion.tsx';
import type { ContextoDelCuadro } from './use-cuadro.ts';

const NINGUNA = 'ninguna';

/** Sangrado, calle y pinza: cada medida se guarda al salir del campo. */
function MedidasDeImposicion({ id, vista, aplicar, editable }: ContextoDelCuadro) {
  const p = vista.imposicion.parametros;
  const medida = (c: CampoDeMedida, etiqueta: string) => (
    <CampoAlSalir
      etiqueta={etiqueta} valor={p[c] ? mostrarDecimal(p[c]) : ''} decimal deshabilitado={!editable}
      alConfirmar={async (t) => {
        const cambio = cambioDeMedida(vista, id, c, t);
        if (cambio === null) return null;
        if ('error' in cambio) return cambio.error;
        return (await aplicar(fijarImposicion(cambio.args))) ? null : 'No se guardó.';
      }}
    />
  );
  return (
    <div className="grid grid-cols-3 gap-3">
      {medida('sangradoCm', 'Sangrado (cm)')}
      {medida('calleCm', 'Calle (cm)')}
      {medida('pinzaCm', 'Pinza (cm)')}
    </div>
  );
}

/** Máquina, pliego madre, pliego de máquina, medidas y fila del papel. La imposición la calcula el servidor. */
export function PanelImposicion(ctx: ContextoDelCuadro) {
  const { id, vista, aplicar, editable } = ctx;
  const p = vista.imposicion.parametros;
  const [maquina, setMaquina] = useState<Opcion | null>(null);
  const dePliego = (d: { anchoCm: string; altoCm: string } | null): Opcion | null => (d ? { id: 'actual', nombre: textoDeDimensiones(d) } : null);

  async function buscarMaquinas(texto: string): Promise<Opcion[]> {
    const { items } = datosOError(await listarMaquinas({ buscar: texto, estado: 'activas' }));
    return items.map((m) => ({ id: m.id, nombre: m.nombre, detalle: `hasta ${medidasDe(m.formatoMaxAnchoCm, m.formatoMaxAltoCm)}` }));
  }
  const buscarPliegos = (tipo: FormatoDePliegoDto['tipo']) => async (texto: string): Promise<Opcion[]> => {
    const { items } = datosOError(await listarFormatos({ buscar: texto, estado: 'activas', tipo }));
    return items.map((f) => ({ id: f.id, nombre: f.nombre, detalle: medidasDe(f.anchoCm, f.altoCm) }));
  };
  const papel = filaDePapel(vista);

  return (
    <Seccion titulo="Imposición">
      <SelectorDeRegistro
        etiqueta="Máquina" valor={maquina} buscar={buscarMaquinas} textoSinResultados="Ninguna máquina se parece a eso"
        ayuda={p.formatoMaximo ? `Formato máximo: ${textoDeDimensiones(p.formatoMaximo)}. Al elegirla se copian pinza, sangrado, calle y mermas.` : 'Al elegirla se copian formato máximo, pinza, sangrado, calle y mermas.'}
        alCambiar={(o) => { setMaquina(o); if (o && editable) void aplicar(fijarImposicion({ id, maquinaId: o.id })); }}
      />
      <SelectorDeRegistro
        etiqueta="Pliego madre (el que se compra)" valor={dePliego(p.pliegoMadre)} buscar={buscarPliegos('madre')} textoSinResultados="Ningún pliego se parece a eso"
        alCambiar={(o) => { if (o && o.id !== 'actual' && editable) void aplicar(fijarImposicion({ id, pliegoMadreId: o.id })); }}
      />
      <SelectorDeRegistro
        etiqueta="Pliego de máquina (al que se corta)" valor={dePliego(p.pliegoMaquina)} buscar={buscarPliegos('maquina')} textoSinResultados="Ningún pliego se parece a eso"
        alCambiar={(o) => { if (o && o.id !== 'actual' && editable) void aplicar(fijarImposicion({ id, pliegoMaquinaId: o.id })); }}
      />
      <MedidasDeImposicion {...ctx} />
      <CampoSelect
        etiqueta="Fila del papel" value={papel?.id ?? NINGUNA} disabled={!editable} ayuda="La fila que el motor llena con los pliegos madre."
        onChange={(e) => void aplicar(fijarImposicion({ id, filaDePapel: e.target.value === NINGUNA ? null : { id: e.target.value } }))}
      >
        <option value={NINGUNA}>Ninguna (la escribo yo)</option>
        {vista.lineas.filter((l) => l.factor === 'material').map((l) => <option key={l.id} value={l.id}>{l.numero}. {l.descripcion}</option>)}
      </CampoSelect>
      {p.etapas.length ? (
        <p className="text-sm text-texto-suave">Mermas: {p.etapas.map((e) => `${e.nombre} ${mostrarDecimal(e.mermaPct)} % + ${e.arranque} hojas`).join(' · ')}</p>
      ) : null}
      {avisosDeImposicion(vista).map((a) => <p key={a} role="status" className="text-sm font-medium text-aviso">{a}</p>)}
    </Seccion>
  );
}
