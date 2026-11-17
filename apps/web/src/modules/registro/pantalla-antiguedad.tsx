import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearSoles, type FilaDeAntiguedadDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { Cifra, GrupoDeCifras } from '../../shared/ui/cifra.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { CLAVE_REGISTRO } from './claves.ts';
import { diaEnZona } from './logica.ts';

type Tipo = 'por_cobrar' | 'por_pagar';

const monto = (c: number) => (c === 0 ? '—' : formatearSoles(c));

const COLUMNAS: Array<Columna<FilaDeAntiguedadDto>> = [
  { id: 'contacto', titulo: 'Contacto', principal: true, celda: (f) => f.contactoNombre },
  { id: 'vigente', titulo: 'Vigente', alinear: 'derecha', celda: (f) => monto(f.vigenteCentimos) },
  { id: 't1', titulo: '1 a 30 días', alinear: 'derecha', celda: (f) => monto(f.de1a30Centimos) },
  { id: 't2', titulo: '31 a 60', alinear: 'derecha', celda: (f) => monto(f.de31a60Centimos) },
  { id: 't3', titulo: '61 a 90', alinear: 'derecha', celda: (f) => monto(f.de61a90Centimos) },
  { id: 't4', titulo: 'Más de 90', alinear: 'derecha', celda: (f) => <span className={f.masDe90Centimos > 0 ? 'font-medium text-peligro' : ''}>{monto(f.masDe90Centimos)}</span> },
  { id: 'total', titulo: 'Total', alinear: 'derecha', celda: (f) => <span className="font-medium tabular-nums">{formatearSoles(f.totalCentimos)}</span> },
];

/** Antigüedad de saldos: cuánto se debe por contacto y hace cuánto venció, por tramos. Cada fila lleva a su estado de cuenta. */
export function PantallaAntiguedad() {
  const navegar = useNavigate();
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [tipo, setTipo] = useState<Tipo>('por_cobrar');
  const [fecha, setFecha] = useState(hoy);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy;
  const consulta = useQuery({ queryKey: [...CLAVE_REGISTRO, 'antiguedad', tipo, dia], queryFn: async () => datosOError(await llamar('deudas_antiguedad', { tipo, fecha: dia })) });

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Antigüedad de saldos" />
      <div className="grid gap-3 sm:grid-cols-[14rem_14rem]">
        <CampoSelect etiqueta="Qué ver" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          <option value="por_cobrar">Lo que me deben</option>
          <option value="por_pagar">Lo que debo</option>
        </CampoSelect>
        <Campo etiqueta="Al día" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>
      {consulta.isPending ? (
        <div aria-busy="true" aria-label="Cargando la antigüedad" className="flex flex-col gap-2"><Esqueleto className="h-20" /><Esqueleto className="h-40" /></div>
      ) : consulta.isError ? (
        <EstadoVacio titulo="No pudimos cargar el reporte" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <GrupoDeCifras etiqueta="Totales por tramo">
            <Cifra etiqueta="Total" valor={formatearSoles(consulta.data.totales.totalCentimos)} />
            <Cifra etiqueta="Vigente" valor={formatearSoles(consulta.data.totales.vigenteCentimos)} tono="exito" />
            <Cifra etiqueta="Vencido hasta 60 días" valor={formatearSoles(consulta.data.totales.de1a30Centimos + consulta.data.totales.de31a60Centimos)} tono="aviso" />
            <Cifra etiqueta="Vencido más de 60 días" valor={formatearSoles(consulta.data.totales.de61a90Centimos + consulta.data.totales.masDe90Centimos)} tono="peligro" />
          </GrupoDeCifras>
          <Lista
            etiqueta="Antigüedad por contacto"
            columnas={COLUMNAS}
            filas={consulta.data.filas}
            clave={(f) => f.contactoId}
            onAbrir={(f) => void navegar(`/m/registro/estado-de-cuenta/${f.contactoId}`)}
            vacio={<EstadoVacio titulo="No hay saldos abiertos" descripcion="Cuando haya deudas pendientes aparecerán aquí por tramos de antigüedad." icono="caja" />}
          />
        </>
      )}
    </div>
  );
}
