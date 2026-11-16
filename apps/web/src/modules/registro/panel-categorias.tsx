import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CategoriaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { archivarCategoria, listarCategorias } from './api.ts';
import { resolverAccion } from './acciones.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { ETIQUETA_DE_TIPO } from './logica.ts';
import { HojaDeCategoria } from './hoja-categoria.tsx';

/** Categorías de ingresos y egresos: lista, alta y renombrado en hoja, archivar. */
export function PanelDeCategorias({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'categorias', 'todas'], queryFn: async () => datosOError(await listarCategorias(true)) });
  const [hoja, setHoja] = useState<{ categoria: CategoriaDto | null } | null>(null);

  const columnas: Array<Columna<CategoriaDto>> = [
    {
      id: 'nombre', titulo: 'Categoría', principal: true,
      celda: (c) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {c.nombre}
          {c.archivadoEn ? <Insignia tono="neutro">Archivada</Insignia> : null}
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', celda: (c) => ETIQUETA_DE_TIPO[c.tipo] },
    ...(puedeConfigurar
      ? [{
          id: 'acciones', titulo: 'Acciones', alinear: 'derecha' as const,
          celda: (c: CategoriaDto) => c.archivadoEn ? '—' : (
            <span className="inline-flex gap-1">
              <Boton variante="fantasma" onClick={() => setHoja({ categoria: c })}>Editar</Boton>
              <Boton variante="fantasma" onClick={() => void resolverAccion(archivarCategoria(c.id), 'Categoría archivada.')}>Archivar</Boton>
            </span>
          ),
        }]
      : []),
  ];

  if (consulta.isPending) return <div aria-busy="true" aria-label="Cargando categorías" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>;
  if (consulta.isError) return <EstadoVacio titulo="No pudimos cargar las categorías" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />;
  return (
    <div className="flex flex-col gap-3">
      {puedeConfigurar ? <div className="flex justify-end"><Boton variante="primario" icono="mas" onClick={() => setHoja({ categoria: null })}>Nueva categoría</Boton></div> : null}
      <Lista etiqueta="Categorías" columnas={columnas} filas={consulta.data.items} clave={(c) => c.id} vacio={<EstadoVacio titulo="Todavía no hay categorías" icono="caja" />} />
      <HojaDeCategoria abierto={hoja !== null} categoria={hoja?.categoria ?? null} alCerrar={() => setHoja(null)} />
    </div>
  );
}
