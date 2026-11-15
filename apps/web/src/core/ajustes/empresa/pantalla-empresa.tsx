import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';
import type { ConfiguracionDeEmpresa, Respuesta } from '@capaz/shared';
import { llamarConfirmando } from '../../../shared/api/herramientas.ts';
import { formatearFechaHora } from '../../../shared/formato/fechas.ts';
import { puede } from '../../../shared/sesion/sesion.ts';
import { useYo } from '../../../shared/sesion/use-yo.ts';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha } from '../../../shared/ui/datos/ficha.tsx';
import { useFicha } from '../../../shared/ui/datos/use-ficha.ts';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { cambiosDeZona, mensajeDeGuardado, zonasDisponibles } from './logica.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="font-medium text-texto">{valor}</dd>
    </div>
  );
}

export function PantallaEmpresa() {
  const lectura = useLoaderData() as Respuesta<ConfiguracionDeEmpresa>;
  const yo = useYo();
  const { revalidate } = useRevalidator();
  const { estado, enviar } = useFicha();
  const [elegida, setElegida] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const encabezado = <EncabezadoDePagina titulo="Empresa" migas={[{ texto: 'Ajustes' }, { texto: 'Empresa' }]} />;
  if (!lectura.ok || !('datos' in lectura)) {
    const mensaje = 'error' in lectura ? lectura.error.mensaje : 'No se pudo cargar la configuración.';
    return (
      <div className="flex flex-col gap-4">
        {encabezado}
        <EstadoVacio titulo="No pudimos cargar la empresa" descripcion={mensaje} icono="caja" />
      </div>
    );
  }
  const config = lectura.datos;
  const zona = elegida ?? config.zonaHoraria;

  async function guardar() {
    const cambios = cambiosDeZona(config.zonaHoraria, zona);
    if (!cambios) {
      enviar('descartar');
      return;
    }
    enviar('guardar');
    setError(undefined);
    const r = await llamarConfirmando('empresa_actualizar_configuracion', cambios, {
      titulo: 'Cambiar la zona horaria',
      textoConfirmar: 'Cambiar',
    });
    if ('cancelada' in r) {
      enviar('fallo'); // sigue editando, sin perder lo elegido
      return;
    }
    if (r.ok && 'datos' in r) {
      enviar('guardado');
      setElegida(null);
      notificar('Zona horaria actualizada.', 'exito');
      revalidate();
      return;
    }
    enviar('fallo');
    if ('error' in r) setError(mensajeDeGuardado(r.error.codigo, r.error.mensaje));
  }

  return (
    <div className="flex flex-col gap-4">
      {encabezado}
      <Ficha
        estado={estado}
        soloLectura={!yo || !puede(yo, 'empresa:configurar')}
        onEditar={() => enviar('editar')}
        onGuardar={guardar}
        onDescartar={() => {
          enviar('descartar');
          setElegida(null);
          setError(undefined);
        }}
        secciones={[
          {
            id: 'regional',
            titulo: 'Zona horaria y formato',
            lectura: (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Dato etiqueta="Zona horaria" valor={config.zonaHoraria} />
                <Dato etiqueta="Moneda" valor={config.moneda} />
                <Dato etiqueta="Idioma" valor={config.locale} />
                <Dato etiqueta="Última modificación" valor={formatearFechaHora(config.actualizadoEn, config.zonaHoraria)} />
              </dl>
            ),
            edicion: (
              <div className="flex max-w-md flex-col gap-3">
                <CampoSelect
                  etiqueta="Zona horaria"
                  ayuda="Cambiarla pide confirmación y queda en el historial."
                  error={error}
                  value={zona}
                  onChange={(e) => {
                    setElegida(e.target.value);
                    enviar('cambio');
                  }}
                >
                  {zonasDisponibles(config.zonaHoraria).map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </CampoSelect>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
