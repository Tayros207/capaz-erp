import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatearFecha } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { BarraDeBusqueda } from '../shared/ui/datos/barra-de-busqueda.tsx';
import { EncabezadoDePagina } from '../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../shared/ui/datos/lista.tsx';
import type { Columna } from '../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';
import { Insignia } from '../shared/ui/insignia.tsx';
import { datosOError, listarEmpresas, type SalidaDePlataforma } from './api.ts';
import { HojaEmpresaNueva } from './hoja-empresa-nueva.tsx';
import { HojaRestablecer } from './hoja-restablecer.tsx';
import { estadoDeModulo } from './logica.ts';
import { CLAVE_EMPRESAS } from './claves.ts';
import { Cargando, ErrorDeConsulta } from './marco.tsx';

type Empresa = SalidaDePlataforma<'plataforma_empresas_listar'>['items'][number];

export function PantallaEmpresas() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [texto, setTexto] = useState('');
  const [creando, setCreando] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const consulta = useQuery({ queryKey: [...CLAVE_EMPRESAS, 'lista', texto.trim()], queryFn: async () => datosOError(await listarEmpresas(texto.trim())).items });

  const columnas: Array<Columna<Empresa>> = [
    { id: 'nombre', titulo: 'Empresa', principal: true, celda: (e) => e.nombre },
    { id: 'modulos', titulo: 'Módulos', celda: (e) => (
      e.modulos.length === 0 ? 'Sin módulos' : (
        <span className="inline-flex flex-wrap gap-1">
          {e.modulos.map((m) => {
            const est = estadoDeModulo(m.estado);
            return <Insignia key={m.modulo} tono={est.tono}>{`${m.modulo}: ${est.texto}`}</Insignia>;
          })}
        </span>
      )
    ) },
    { id: 'miembros', titulo: 'Miembros', alinear: 'derecha', celda: (e) => e.miembros },
    { id: 'alta', titulo: 'Alta', celda: (e) => formatearFecha(e.altaEn) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Empresas"
        migas={[{ texto: 'Plataforma' }, { texto: 'Empresas' }]}
        accionPrincipal={<Boton variante="primario" icono="mas" onClick={() => setCreando(true)}>Crear empresa</Boton>}
        accionesSecundarias={<Boton onClick={() => setRestableciendo(true)}>Restablecer contraseña</Boton>}
      />
      <BarraDeBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar empresa" placeholder="Buscar empresa…" />
      {consulta.isPending ? (
        <Cargando />
      ) : consulta.isError ? (
        <ErrorDeConsulta error={consulta.error} />
      ) : (
        <Lista
          etiqueta="Empresas de la plataforma"
          columnas={columnas}
          filas={consulta.data}
          clave={(e) => e.id}
          onAbrir={(e) => void navegar(`/plataforma/empresas/${encodeURIComponent(e.id)}`)}
          vacio={<EstadoVacio titulo="Sin empresas" descripcion="Crea la primera empresa de la plataforma." icono="carpeta" />}
        />
      )}
      <HojaEmpresaNueva abierto={creando} alCerrar={() => setCreando(false)} alCambiar={() => void cliente.invalidateQueries({ queryKey: CLAVE_EMPRESAS })} />
      <HojaRestablecer abierto={restableciendo} alCerrar={() => setRestableciendo(false)} />
    </div>
  );
}
