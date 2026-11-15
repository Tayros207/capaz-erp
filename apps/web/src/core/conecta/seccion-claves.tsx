import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ClaveApi } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { crearClaveApi, datosOError, listarClavesApi, revocarClaveApi } from './api.ts';
import { CLAVE_CLAVES_API } from './claves.ts';
import { HojaSecreto, type SecretoMostrado } from './hoja-secreto.tsx';
import { fechaHora, validarNombre } from './logica.ts';

function FormularioNueva({ alCrear, alCerrar }: { alCrear: (s: SecretoMostrado) => void; alCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function crear() {
    const e = validarNombre(nombre, 'a la clave');
    setError(e);
    if (e) return;
    setOcupado(true);
    const r = await crearClaveApi(nombre.trim());
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      alCrear({ titulo: 'Clave de API creada', explicacion: `Esta es la clave «${r.datos.nombre}». Úsala en tu sistema para enviar webhooks de entrada.`, etiqueta: 'Clave de API', valor: r.datos.clave });
    } else if ('error' in r) setError(r.error.mensaje);
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void crear(); }}>
      <Campo etiqueta="Nombre de la clave" ayuda="Para reconocerla luego, por ejemplo «Zapier» o «Mi tienda»." value={nombre} error={error} disabled={ocupado} autoComplete="off" onChange={(e) => setNombre(e.target.value)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Crear clave</Boton>
      </div>
    </form>
  );
}

export function SeccionClaves({ puedeGestionar }: { puedeGestionar: boolean }) {
  const consultas = useQueryClient();
  const [nueva, setNueva] = useState(false);
  const [secreto, setSecreto] = useState<SecretoMostrado | null>(null);
  const consulta = useQuery({ queryKey: CLAVE_CLAVES_API, queryFn: async () => datosOError(await listarClavesApi()) });

  async function revocar(c: ClaveApi) {
    const r = await revocarClaveApi(c.id);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_CLAVES_API });
      notificar('Clave revocada.', 'exito');
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  const columnas: Array<Columna<ClaveApi>> = [
    { id: 'nombre', titulo: 'Nombre', principal: true, celda: (c) => c.nombre },
    { id: 'prefijo', titulo: 'Clave', celda: (c) => <code>{c.prefijo}…</code> },
    { id: 'estado', titulo: 'Estado', celda: (c) => (c.revocadaEn ? <Insignia tono="neutro">Revocada</Insignia> : <Insignia tono="exito">Vigente</Insignia>) },
    { id: 'uso', titulo: 'Último uso', celda: (c) => fechaHora(c.ultimoUsoEn) },
    {
      id: 'acciones',
      titulo: 'Acciones',
      celda: (c) => (puedeGestionar && !c.revocadaEn ? <Boton variante="peligro" onClick={() => void revocar(c)}>Revocar</Boton> : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-texto-suave">Las claves de API permiten que otro sistema (Zapier, Make, n8n…) te envíe webhooks de entrada. La clave completa se muestra una sola vez.</p>
        {puedeGestionar ? <Boton variante="primario" icono="mas" onClick={() => setNueva(true)}>Nueva clave</Boton> : null}
      </div>
      {consulta.isPending ? (
        <div aria-busy="true" aria-label="Cargando claves" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : consulta.isError ? (
        <EstadoVacio titulo="No pudimos cargar las claves" descripcion={consulta.error.message} icono="caja" accion={<Boton onClick={() => void consulta.refetch()}>Reintentar</Boton>} />
      ) : (
        <Lista etiqueta="Claves de API" columnas={columnas} filas={consulta.data.items} clave={(c) => c.id} vacio={<EstadoVacio titulo="Todavía no hay claves" descripcion="Crea una para conectar otro sistema." icono="caja" />} />
      )}
      <HojaInferior abierto={nueva} alCerrar={() => setNueva(false)} titulo="Nueva clave de API">
        {nueva ? (
          <FormularioNueva
            alCerrar={() => setNueva(false)}
            alCrear={(s) => {
              setNueva(false);
              setSecreto(s);
              void consultas.invalidateQueries({ queryKey: CLAVE_CLAVES_API });
            }}
          />
        ) : null}
      </HojaInferior>
      <HojaSecreto secreto={secreto} alCerrar={() => setSecreto(null)} />
    </div>
  );
}
