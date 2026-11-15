import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import type { Invitacion, Miembro } from '@capaz/shared';
import { puede } from '../../../shared/sesion/sesion.ts';
import { useYo } from '../../../shared/sesion/use-yo.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { confirmar } from '../../../shared/ui/confirmar.ts';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Lista } from '../../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { anularInvitacion, type DatosDeUsuarios } from './api.ts';
import { copiarEnlace } from './copiar-enlace.ts';
import { HojaInvitar } from './hoja-invitar.tsx';
import { HojaMiembro } from './hoja-miembro.tsx';
import { enlaceAbsoluto, entraATodo, estadoDeInvitacion, etiquetaDeRol, mensajeDeRechazo, modulosAsignables, pendientes, resumenDeModulos, textoDeCupo } from './logica.ts';

export function PantallaUsuarios() {
  const datos = useLoaderData() as DatosDeUsuarios;
  const yo = useYo();
  const { revalidate } = useRevalidator();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [invitando, setInvitando] = useState(false);
  const puedeGestionar = !!yo && puede(yo, 'miembros:gestionar');
  const migas = [{ texto: 'Ajustes' }, { texto: 'Usuarios' }];

  if (!yo || !puede(yo, 'miembros:ver')) {
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Usuarios" migas={migas} />
        <EstadoVacio titulo="Sin acceso" descripcion="Solo propietarios y administradores ven a las personas de la empresa." icono="usuario" />
      </div>
    );
  }
  if (!datos.miembros.ok || !('datos' in datos.miembros)) {
    const mensaje = 'error' in datos.miembros ? datos.miembros.error.mensaje : 'No se pudo cargar la lista.';
    return (
      <div className="flex flex-col gap-4">
        <EncabezadoDePagina titulo="Usuarios" migas={migas} />
        <EstadoVacio titulo="No pudimos cargar a las personas" descripcion={mensaje} icono="usuario" />
      </div>
    );
  }

  const lista = datos.miembros.datos;
  const modulos = modulosAsignables(yo.modulos);
  const nombres = new Map(yo.modulos.map((m) => [m.codigo, m.nombre]));
  const invitaciones = datos.invitaciones && datos.invitaciones.ok && 'datos' in datos.invitaciones ? datos.invitaciones.datos.invitaciones : [];
  const abiertas = pendientes(invitaciones);
  const miembro = lista.miembros.find((m) => m.personaId === abierta) ?? null;

  const columnas: Array<Columna<Miembro>> = [
    { id: 'nombre', titulo: 'Nombre', principal: true, celda: (m) => (
      <span className="inline-flex flex-wrap items-center gap-2">{m.nombre}{m.personaId === yo.usuario.id ? <Insignia tono="info">Tú</Insignia> : null}</span>
    ) },
    { id: 'correo', titulo: 'Correo', celda: (m) => m.correo },
    { id: 'rol', titulo: 'Rol', celda: (m) => <Insignia tono={entraATodo(m.rol) ? 'exito' : 'neutro'}>{etiquetaDeRol(m.rol)}</Insignia> },
    { id: 'modulos', titulo: 'Módulos', celda: (m) => resumenDeModulos(m, nombres) },
  ];

  const columnasDeInvitaciones: Array<Columna<Invitacion>> = [
    { id: 'correo', titulo: 'Correo', principal: true, celda: (i) => i.correo },
    { id: 'rol', titulo: 'Rol', celda: (i) => etiquetaDeRol(i.rol) },
    { id: 'estado', titulo: 'Estado', celda: (i) => { const e = estadoDeInvitacion(i); return <Insignia tono={e.tono}>{e.texto}</Insignia>; } },
    { id: 'acciones', titulo: 'Acciones', celda: (i) => (puedeGestionar && i.estado === 'pending' ? (
      <span className="inline-flex flex-wrap gap-2">
        <Boton onClick={() => void copiarEnlace(enlaceAbsoluto(i.ruta, window.location.origin))}>Copiar enlace</Boton>
        <Boton variante="peligro" onClick={() => void anular(i)}>Anular</Boton>
      </span>
    ) : null) },
  ];

  async function anular(i: Invitacion) {
    if (!(await confirmar('Anular invitación', `El enlace enviado a ${i.correo} dejará de funcionar.`, { textoConfirmar: 'Anular', peligroso: true }))) return;
    const r = await anularInvitacion(i.id);
    if (r.ok) {
      notificar('Invitación anulada.', 'exito');
      revalidate();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo="Usuarios"
        migas={migas}
        accionPrincipal={puedeGestionar ? <Boton variante="primario" icono="mas" onClick={() => setInvitando(true)}>Invitar</Boton> : undefined}
      />
      <p className="text-sm text-texto-suave">{textoDeCupo(lista)}</p>
      <Lista
        etiqueta="Personas de la empresa"
        columnas={columnas}
        filas={lista.miembros}
        clave={(m) => m.personaId}
        onAbrir={(m) => setAbierta(m.personaId)}
        vacio={<EstadoVacio titulo="Sin personas" descripcion="Invita a la primera persona de tu equipo." icono="usuario" />}
      />
      {puedeGestionar ? (
        <section className="flex flex-col gap-2" aria-label="Invitaciones">
          <h2 className="font-titulo text-lg font-semibold">Invitaciones</h2>
          <Lista
            etiqueta="Invitaciones"
            columnas={columnasDeInvitaciones}
            filas={invitaciones}
            clave={(i) => i.id}
            vacio={<EstadoVacio titulo="Sin invitaciones" descripcion="Las invitaciones que crees aparecen aquí con su enlace." icono="carpeta" />}
          />
          {abiertas.length === 0 ? null : <p className="text-sm text-texto-suave">Copia el enlace y envíaselo a la persona: Capaz no envía correos.</p>}
        </section>
      ) : null}
      <HojaMiembro
        miembro={miembro}
        miRol={yo.empresa?.rol ?? 'member'}
        miId={yo.usuario.id}
        modulos={modulos}
        puedeGestionar={puedeGestionar}
        alCerrar={() => setAbierta(null)}
        alCambiar={revalidate}
      />
      <HojaInvitar abierto={invitando} alCerrar={() => setInvitando(false)} alCambiar={revalidate} />
    </div>
  );
}
