import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Conector } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { datosOError, listarConectores } from './api.ts';
import { CLAVE_CONECTORES } from './claves.ts';
import { HojaConexion } from './hoja-conexion.tsx';
import { ETIQUETA_DE_AUTENTICACION, ETIQUETA_DE_ESTADO_DE_CONEXION, TONO_DE_ESTADO_DE_CONEXION } from './logica.ts';

const COLUMNAS: Array<Columna<Conector>> = [
  { id: 'nombre', titulo: 'Conector', principal: true, valorDeOrden: (c) => c.nombre.toLocaleLowerCase('es'), celda: (c) => c.nombre },
  {
    id: 'estado',
    titulo: 'Estado',
    celda: (c) =>
      !c.moduloActivo ? <Insignia tono="neutro">No disponible</Insignia>
      : c.estado ? <Insignia tono={TONO_DE_ESTADO_DE_CONEXION[c.estado]}>{ETIQUETA_DE_ESTADO_DE_CONEXION[c.estado]}</Insignia>
      : <Insignia tono="info">Sin conectar</Insignia>,
  },
  { id: 'auth', titulo: 'Acceso', celda: (c) => ETIQUETA_DE_AUTENTICACION[c.autenticacion] },
  { id: 'capacidades', titulo: 'Qué hace', celda: (c) => (c.capacidades.length ? c.capacidades.join(', ').replaceAll('_', ' ') : '—') },
  { id: 'descripcion', titulo: 'Descripción', celda: (c) => c.descripcion ?? '—' },
];

export function SeccionConectores({ puedeGestionar }: { puedeGestionar: boolean }) {
  const [elegido, setElegido] = useState<Conector | null>(null);
  const consulta = useQuery({ queryKey: CLAVE_CONECTORES, queryFn: async () => datosOError(await listarConectores()) });

  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando conectores" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar los conectores" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-texto-suave">Elige un conector para ver su estado o configurarlo. Las credenciales se guardan cifradas y nunca se vuelven a mostrar.</p>
      <Lista
        etiqueta="Conectores"
        columnas={COLUMNAS}
        filas={consulta.data.items}
        clave={(c) => c.codigo}
        onAbrir={setElegido}
        vacio={<EstadoVacio titulo="Todavía no hay conectores" descripcion="Cuando haya conectores disponibles aparecerán aquí." icono="caja" />}
      />
      <HojaConexion conector={elegido} puedeGestionar={puedeGestionar} alCerrar={() => setElegido(null)} />
    </div>
  );
}
