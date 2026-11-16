import { useState } from 'react';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { PanelDeCategorias } from './panel-categorias.tsx';
import { PanelDeCuentas } from './panel-cuentas.tsx';
import { usePuedeEditar } from './use-registro.ts';

/** Ajustes de Finanzas: cuentas y categorías. Quien no puede configurar las ve, sin acciones. */
export function PantallaAjustes() {
  const puedeConfigurar = usePuedeEditar('registro:configurar');
  const [activa, setActiva] = useState('cuentas');
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Ajustes de Finanzas" />
      <Pestanas
        etiqueta="Ajustes de Finanzas"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { id: 'cuentas', etiqueta: 'Cuentas', contenido: <PanelDeCuentas puedeConfigurar={puedeConfigurar} /> },
          { id: 'categorias', etiqueta: 'Categorías', contenido: <PanelDeCategorias puedeConfigurar={puedeConfigurar} /> },
        ]}
      />
    </div>
  );
}
