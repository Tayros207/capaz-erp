import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { cambiarModelo, CLAVE_CONFIGURACION_DEL_AGENTE, CLAVE_ESTADO_DEL_AGENTE, verConfiguracionDelAgente } from './api.ts';
import { CargandoLista, ErrorConReintento } from './piezas-de-vista.tsx';
import { SelectorDeModelo } from './selector-de-modelo.tsx';

/** El selector con datos reales: lee la configuración y, al elegir, pide la confirmación en dos pasos que redacta el servidor. */
export function ModeloConectado({ puedeConfigurar }: { puedeConfigurar: boolean }): ReactNode {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const consulta = useQuery({ queryKey: CLAVE_CONFIGURACION_DEL_AGENTE, queryFn: async () => datosOError(await verConfiguracionDelAgente()) });

  async function elegir(modelo: string | null): Promise<void> {
    setOcupado(true);
    const r = await cambiarModelo(modelo);
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar('Modelo cambiado', 'exito');
      void cliente.invalidateQueries({ queryKey: CLAVE_CONFIGURACION_DEL_AGENTE });
      void cliente.invalidateQueries({ queryKey: CLAVE_ESTADO_DEL_AGENTE });
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  if (consulta.isPending) return <CargandoLista etiqueta="Cargando modelos" alto="h-24" />;
  if (consulta.isError) return <ErrorConReintento mensaje={consulta.error instanceof Error ? consulta.error.message : 'No se pudo cargar la configuración.'} alReintentar={() => void consulta.refetch()} />;
  const d = consulta.data;
  return <SelectorDeModelo configuracion={d.configuracion} catalogo={d.catalogo} preciosDisponibles={d.preciosDisponibles} puedeConfigurar={puedeConfigurar} ocupado={ocupado} alElegir={(m) => void elegir(m)} />;
}
