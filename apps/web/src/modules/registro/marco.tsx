import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router';
import { seccionesDe } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { NavegacionDeSeccion } from '../../shared/ui/navegacion-de-seccion.tsx';
import { iniciarRegistro } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';
import { debeIniciar } from './logica.ts';
import { useCuentas, usePuedeEditar } from './use-registro.ts';

/**
 * Marco de Finanzas: navegación entre sus secciones y, al entrar, la preparación de los catálogos
 * (una sola vez, si no hay cuentas y la persona puede editar).
 */
export function MarcoDeRegistro() {
  const yo = useYo();
  const consultas = useQueryClient();
  const puedeEditar = usePuedeEditar();
  const cuentas = useCuentas();
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current || !debeIniciar(cuentas.data?.items, puedeEditar)) return;
    iniciado.current = true;
    void iniciarRegistro().then((r) => (r.ok ? consultas.invalidateQueries({ queryKey: CLAVE_REGISTRO }) : undefined));
  }, [cuentas.data, puedeEditar, consultas]);

  const secciones = seccionesDe(yo, 'registro').map((s) => ({ a: s.ruta, texto: s.nombre }));
  return (
    <div className="flex flex-col gap-4">
      {secciones.length > 0 ? <NavegacionDeSeccion etiqueta="Secciones de Finanzas" secciones={secciones} /> : null}
      <Outlet />
    </div>
  );
}
