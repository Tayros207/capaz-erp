import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Regla } from '@capaz/shared';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { activarRegla, datosOError, desactivarRegla, verRegla } from './api.ts';
import { CLAVE_REGLA } from './claves.ts';
import { FormularioRegla } from './formulario-regla.tsx';
import { Historial } from './historial.tsx';
import { FORMULARIO_VACIO, formularioDeRegla, type FormularioDeRegla } from './logica.ts';
import { PanelProbar } from './panel-probar.tsx';

const LISTA = '/ajustes/automatizaciones';

function Editor({ regla, puedeGestionar }: { regla: Regla | null; puedeGestionar: boolean }) {
  const navegar = useNavigate();
  const consultas = useQueryClient();
  const inicial = regla ? formularioDeRegla(regla) : FORMULARIO_VACIO;
  const [actual, setActual] = useState<FormularioDeRegla>(inicial);
  const [pestana, setPestana] = useState('definicion');
  const [ocupado, setOcupado] = useState(false);
  const sinGuardar = JSON.stringify(actual) !== JSON.stringify(inicial);

  async function alGuardar(r: Regla) {
    await consultas.invalidateQueries({ queryKey: ['automatizaciones'] });
    notificar(regla ? 'Regla guardada.' : 'Regla creada. Está apagada: pruébala y luego actívala.', 'exito');
    if (!regla) void navegar(`${LISTA}/${r.id}`, { replace: true });
  }

  async function alternar() {
    if (!regla) return;
    setOcupado(true);
    if (regla.activa) {
      const r = await desactivarRegla(regla.id);
      if (!(r.ok && 'datos' in r) && 'error' in r) notificar(r.error.mensaje, 'error');
    } else {
      const r = await activarRegla(regla.id);
      if (!('cancelada' in r) && !(r.ok && 'datos' in r) && 'error' in r) notificar(r.error.mensaje, 'error');
    }
    setOcupado(false);
    await consultas.invalidateQueries({ queryKey: ['automatizaciones'] });
  }

  const definicion = <FormularioRegla key={regla?.actualizadoEn ?? 'nueva'} inicial={inicial} reglaId={regla?.id} soloLectura={!puedeGestionar} alGuardar={(r) => void alGuardar(r)} alCambiar={setActual} />;
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={regla ? regla.nombre : 'Nueva regla'}
        migas={[{ texto: 'Ajustes' }, { texto: 'Automatizaciones', a: LISTA }, { texto: regla ? regla.nombre : 'Nueva' }]}
        accionesSecundarias={regla ? <Insignia tono={regla.activa ? 'exito' : 'neutro'}>{regla.activa ? 'Activa' : 'Apagada'}</Insignia> : undefined}
        accionPrincipal={regla && puedeGestionar ? <Boton variante={regla.activa ? 'secundario' : 'primario'} cargando={ocupado} onClick={() => void alternar()}>{regla.activa ? 'Desactivar' : 'Activar'}</Boton> : undefined}
      />
      {regla ? (
        <Pestanas
          etiqueta="Secciones de la regla"
          activa={pestana}
          onCambio={setPestana}
          pestanas={[
            { id: 'definicion', etiqueta: 'Definición', contenido: definicion },
            { id: 'probar', etiqueta: 'Probar', contenido: <PanelProbar regla={regla} sinGuardar={sinGuardar} puedeGestionar={puedeGestionar} /> },
            { id: 'historial', etiqueta: 'Historial', contenido: <Historial reglaId={regla.id} /> },
          ]}
        />
      ) : definicion}
    </div>
  );
}

export function PantallaRegla() {
  const { id } = useParams();
  const yo = useYo();
  const gestiona = !!yo && puede(yo, 'automatizaciones:gestionar');
  const consulta = useQuery({ queryKey: [...CLAVE_REGLA, id], queryFn: async () => datosOError(await verRegla(id ?? '')), enabled: !!id });

  if (!id) return <Editor regla={null} puedeGestionar={gestiona} />;
  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando la regla" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-40" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar la regla" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return <Editor regla={consulta.data} puedeGestionar={gestiona} />;
}

