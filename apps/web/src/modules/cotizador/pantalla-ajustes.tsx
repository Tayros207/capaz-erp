import { useState } from 'react';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { PanelDeAjustesDeCliente } from './panel-ajustes-cliente.tsx';
import { PanelDeConfiguracion } from './panel-configuracion.tsx';
import { SeccionesDelCotizador } from './marco.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

/** Ajustes del Cotizador: reglas generales y precios especiales por cliente. Quien no puede configurar los ve, sin acciones. */
export function PantallaAjustes() {
  const { configurar, editar } = usePermisosDelCotizador();
  const [activa, setActiva] = useState('reglas');
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Ajustes del Cotizador" />
      <SeccionesDelCotizador />
      <Pestanas
        etiqueta="Ajustes del Cotizador"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { id: 'reglas', etiqueta: 'Reglas generales', contenido: <PanelDeConfiguracion puedeConfigurar={configurar} puedePreparar={editar} /> },
          { id: 'clientes', etiqueta: 'Precios por cliente', contenido: <PanelDeAjustesDeCliente puedeConfigurar={configurar} /> },
        ]}
      />
    </div>
  );
}
