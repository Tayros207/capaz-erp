import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { cambiarModelo, CLAVE_CONFIGURACION_DEL_AGENTE, CLAVE_ESTADO_DEL_AGENTE, verConfiguracionDelAgente } from './api.ts';
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

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando modelos" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => <Esqueleto key={i} className="h-24 w-full" />)}
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm text-texto">
        <p>{consulta.error instanceof Error ? consulta.error.message : 'No se pudo cargar la configuración.'}</p>
        <Boton variante="secundario" onClick={() => void consulta.refetch()}>Reintentar</Boton>
      </div>
    );
  }
  const d = consulta.data;
  return <SelectorDeModelo configuracion={d.configuracion} catalogo={d.catalogo} preciosDisponibles={d.preciosDisponibles} puedeConfigurar={puedeConfigurar} ocupado={ocupado} alElegir={(m) => void elegir(m)} />;
}
