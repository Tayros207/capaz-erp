import { useState } from 'react';
import { useRevalidator } from 'react-router';
import type { ConfiguracionDeEmpresa } from '@capaz/shared';
import { refrescarDatosDeEmpresa } from '../../../shared/impresion/usar-datos-de-empresa.ts';
import { llamarConfirmando } from '../../../shared/api/herramientas.ts';
import { useFicha } from '../../../shared/ui/datos/use-ficha.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { mensajeDeGuardado } from './logica.ts';
import { cambiosDeEmpresa, formularioDesde, tituloDeConfirmacion, validarDatos, type ErroresDeEmpresa, type FormularioDeEmpresa } from './logica-datos.ts';

/** Estado de edición de la pantalla: formulario, errores y guardado con confirmación. */
export function useEdicionDeEmpresa(config: ConfiguracionDeEmpresa) {
  const { estado, enviar } = useFicha();
  const { revalidate } = useRevalidator();
  const [editado, setEditado] = useState<FormularioDeEmpresa | null>(null);
  const [errores, setErrores] = useState<ErroresDeEmpresa>({});
  const [errorDelServidor, setErrorDelServidor] = useState<string | undefined>();
  const form = editado ?? formularioDesde(config);

  function cambiar(parcial: Partial<FormularioDeEmpresa>) {
    setEditado({ ...form, ...parcial });
    setErrores({});
    enviar('cambio');
  }

  function descartar() {
    enviar('descartar');
    setEditado(null);
    setErrores({});
    setErrorDelServidor(undefined);
  }

  async function guardar() {
    const cambios = cambiosDeEmpresa(config, form);
    if (!cambios) return descartar();
    const invalidos = validarDatos(form);
    if (Object.keys(invalidos).length > 0) return setErrores(invalidos);
    enviar('guardar');
    setErrorDelServidor(undefined);
    const r = await llamarConfirmando('empresa_actualizar_configuracion', cambios, { titulo: tituloDeConfirmacion(cambios), textoConfirmar: 'Guardar' });
    if ('cancelada' in r) return enviar('fallo'); // sigue editando, sin perder lo escrito
    if (r.ok && 'datos' in r) {
      enviar('guardado');
      setEditado(null);
      notificar('Datos de la empresa guardados.', 'exito');
      void refrescarDatosDeEmpresa();
      return revalidate();
    }
    enviar('fallo');
    if ('error' in r) setErrorDelServidor(mensajeDeGuardado(r.error.codigo, r.error.mensaje));
  }

  return { estado, enviar, form, errores, errorDelServidor, cambiar, descartar, guardar };
}
