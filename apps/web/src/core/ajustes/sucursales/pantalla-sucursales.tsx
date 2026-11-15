import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import type { Respuesta, SucursalDto } from '@capaz/shared';
import { puede } from '../../../shared/sesion/sesion.ts';
import { useYo } from '../../../shared/sesion/use-yo.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { HojaSucursal } from './hoja-sucursal.tsx';
import { filtrarSucursales } from './logica.ts';

const COLUMNAS: Array<Columna<SucursalDto>> = [
  { id: 'codigo', titulo: 'Código', principal: true, celda: (s) => s.codigo },
  {
    id: 'nombre',
    titulo: 'Nombre',
    celda: (s) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        {s.nombre}
        {s.esPrincipal ? <Insignia tono="exito">Principal</Insignia> : null}
        {s.archivadoEn ? <Insignia tono="neutro">Archivada</Insignia> : null}
      </span>
    ),
  },
  { id: 'direccion', titulo: 'Dirección', celda: (s) => s.direccion ?? '—' },
  { id: 'telefono', titulo: 'Teléfono', celda: (s) => s.telefono ?? '—' },
];

type Hoja = { abierta: boolean; sucursal: SucursalDto | null };

export function PantallaSucursales() {
  const lectura = useLoaderData() as Respuesta<{ items: SucursalDto[]; siguiente: string | null }>;
  const yo = useYo();
  const { revalidate } = useRevalidator();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [hoja, setHoja] = useState<Hoja>({ abierta: false, sucursal: null });
  const puedeGestionar = !!yo && puede(yo, 'sucursales:gestionar');
  const migas = [{ texto: 'Ajustes' }, { texto: 'Sucursales' }];

  if (!lectura.ok || !('datos' in lectura)) {
    const mensaje = 'error' in lectura ? lectura.error.mensaje : 'No se pudo cargar la lista.';
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Sucursales" migas={migas} />
        <EstadoVacio titulo="No pudimos cargar las sucursales" descripcion={mensaje} icono="caja" />
      </div>
    );
  }
  const filas = filtrarSucursales(lectura.datos.items, verArchivadas);
  const abrir = (sucursal: SucursalDto | null) => setHoja({ abierta: true, sucursal });

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Sucursales"
        migas={migas}
        accionPrincipal={puedeGestionar ? <Boton variante="primario" icono="mas" onClick={() => abrir(null)}>Nueva sucursal</Boton> : undefined}
      />
      <div className="max-w-56">
        <CampoSelect etiqueta="Mostrar" value={verArchivadas ? 'todas' : 'activas'} onChange={(e) => setVerArchivadas(e.target.value === 'todas')}>
          <option value="activas">Activas</option>
          <option value="todas">Activas y archivadas</option>
        </CampoSelect>
      </div>
      <Lista
        etiqueta="Sucursales"
        columnas={COLUMNAS}
        filas={filas}
        clave={(s) => s.id}
        onAbrir={(s) => abrir(s)}
        vacio={<EstadoVacio titulo="Sin sucursales" descripcion="Crea la primera sucursal de la empresa." icono="carpeta" />}
      />
      <HojaSucursal abierto={hoja.abierta} sucursal={hoja.sucursal} puedeGestionar={puedeGestionar} alCerrar={() => setHoja((h) => ({ ...h, abierta: false }))} alCambiar={revalidate} />
    </div>
  );
}
