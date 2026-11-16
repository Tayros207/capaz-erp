import type { ReactNode } from 'react';
import { useLoaderData } from 'react-router';
import type { ConfiguracionDeEmpresa, Respuesta } from '@capaz/shared';
import { formatearFechaHora } from '../../../shared/formato/fechas.ts';
import { puede } from '../../../shared/sesion/sesion.ts';
import { useYo } from '../../../shared/sesion/use-yo.ts';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { EncabezadoDePagina } from '../../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha, type SeccionDeFicha } from '../../../shared/ui/datos/ficha.tsx';
import { EstadoVacio } from '../../../shared/ui/estado-vacio.tsx';
import { Dato, EdicionDeIdentidad, EdicionDePie, LecturaDeIdentidad, LecturaDePie } from './campos-de-empresa.tsx';
import { zonasDisponibles } from './logica.ts';
import { useEdicionDeEmpresa } from './use-guardar-empresa.ts';

function seccionesDeEmpresa(config: ConfiguracionDeEmpresa, e: ReturnType<typeof useEdicionDeEmpresa>): SeccionDeFicha[] {
  const { form, errores, cambiar } = e;
  return [
    { id: 'identidad', titulo: 'Datos para tus documentos', lectura: <LecturaDeIdentidad config={config} />, edicion: <EdicionDeIdentidad form={form} errores={errores} cambiar={cambiar} /> },
    { id: 'pie', titulo: 'Pie de documento', lectura: <LecturaDePie config={config} />, edicion: <EdicionDePie form={form} errores={errores} cambiar={cambiar} /> },
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
            ayuda="Cambiarla o guardar los datos pide confirmación y queda en el historial."
            value={form.zonaHoraria}
            onChange={(ev) => cambiar({ zonaHoraria: ev.target.value })}
          >
            {zonasDisponibles(config.zonaHoraria).map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </CampoSelect>
        </div>
      ),
    },
  ];
}

export function PantallaEmpresa() {
  const lectura = useLoaderData() as Respuesta<ConfiguracionDeEmpresa>;
  const yo = useYo();
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
  return <ContenidoDeEmpresa config={lectura.datos} soloLectura={!yo || !puede(yo, 'empresa:configurar')} encabezado={encabezado} />;
}

function ContenidoDeEmpresa({ config, soloLectura, encabezado }: { config: ConfiguracionDeEmpresa; soloLectura: boolean; encabezado: ReactNode }) {
  const e = useEdicionDeEmpresa(config);
  return (
    <div className="flex flex-col gap-4">
      {encabezado}
      {e.errorDelServidor ? (
        <p role="alert" className="rounded-control border border-peligro px-3 py-2 text-sm font-medium text-peligro">
          {e.errorDelServidor}
        </p>
      ) : null}
      <Ficha
        estado={e.estado}
        soloLectura={soloLectura}
        onEditar={() => e.enviar('editar')}
        onGuardar={e.guardar}
        onDescartar={e.descartar}
        secciones={seccionesDeEmpresa(config, e)}
      />
    </div>
  );
}
