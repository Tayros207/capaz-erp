import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { formatearSoles } from '../shared/formato/soles.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../shared/ui/datos/lista.tsx';
import type { Columna } from '../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { datosOError, listarPlanes } from './api.ts';
import { HojaPlan, type Plan } from './hoja-plan.tsx';
import { CLAVE_PLANES } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

export function PantallaPlanes() {
  const cliente = useQueryClient();
  const [abierto, setAbierto] = useState<{ plan: Plan | null } | null>(null);
  const consulta = useQuery({ queryKey: CLAVE_PLANES, queryFn: async () => datosOError(await listarPlanes()).items });

  const columnas: Array<Columna<Plan>> = [
    { id: 'nombre', titulo: 'Plan', principal: true, celda: (p) => p.nombre },
    { id: 'codigo', titulo: 'Código', celda: (p) => p.codigo },
    { id: 'precio', titulo: 'Precio', alinear: 'derecha', celda: (p) => formatearSoles(p.precioCentimos) },
    { id: 'usuarios', titulo: 'Usuarios incluidos', alinear: 'derecha', celda: (p) => p.usuariosIncluidos ?? 'Sin tope' },
    { id: 'modulos', titulo: 'Módulos', celda: (p) => (p.modulos.length === 0 ? '—' : p.modulos.join(', ')) },
    { id: 'estado', titulo: 'Estado', celda: (p) => <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Insignia> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Planes y precios"
        migas={[{ texto: 'Plataforma' }, { texto: 'Planes' }]}
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setAbierto({ plan: null })}>Plan nuevo</Boton>}
      />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : (
        <Lista
          etiqueta="Planes"
          columnas={columnas}
          filas={consulta.data}
          clave={(p) => p.codigo}
          onAbrir={(p) => setAbierto({ plan: p })}
          vacio={<EstadoVacio titulo="Sin planes" descripcion="Crea el primer plan con su precio." icono="caja" />}
        />
      )}
      <HojaPlan
        key={abierto?.plan?.codigo ?? 'nuevo'}
        abierto={abierto !== null}
        plan={abierto?.plan ?? null}
        alCerrar={() => setAbierto(null)}
        alCambiar={() => void cliente.invalidateQueries({ queryKey: CLAVE_PLANES })}
      />
    </div>
  );
}
