import { useState } from 'react';
import { TIPOS_DE_ACTIVIDAD } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearActividad } from './api.ts';
import { useEscribir } from './acciones.ts';
import { ETIQUETA_DE_ACTIVIDAD, type TipoDeActividad } from './logica.ts';

/** Alta de una actividad en una oportunidad. */
export function HojaNuevaActividad({ oportunidadId, abierto, alCerrar }: { oportunidadId: string; abierto: boolean; alCerrar: () => void }) {
  const escribir = useEscribir();
  const [tipo, setTipo] = useState<TipoDeActividad>('llamada');
  const [asunto, setAsunto] = useState('');
  const [venceEl, setVenceEl] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    setAsunto('');
    setVenceEl('');
    setNota('');
    setError(undefined);
    alCerrar();
  }

  async function guardar() {
    if (!asunto.trim()) {
      setError('Indica el asunto.');
      return;
    }
    setEnviando(true);
    const r = await escribir(crearActividad({ oportunidadId, tipo, asunto: asunto.trim(), venceEl: venceEl || null, nota: nota.trim() || null }), 'Actividad anotada.');
    setEnviando(false);
    if (r) cerrar();
  }

  return (
    <HojaInferior abierto={abierto} alCerrar={cerrar} titulo="Nueva actividad">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <CampoSelect etiqueta="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeActividad)}>
          {TIPOS_DE_ACTIVIDAD.map((t) => <option key={t} value={t}>{ETIQUETA_DE_ACTIVIDAD[t]}</option>)}
        </CampoSelect>
        <Campo etiqueta="Asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} error={error} maxLength={160} />
        <Campo etiqueta="Vence el" type="date" value={venceEl} onChange={(e) => setVenceEl(e.target.value)} />
        <CampoTextarea etiqueta="Nota" value={nota} onChange={(e) => setNota(e.target.value)} filas={3} />
        <Boton variante="primario" type="submit" cargando={enviando}>Anotar actividad</Boton>
      </form>
    </HojaInferior>
  );
}
