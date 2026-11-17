import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCotizador } from './acciones.ts';
import { sembrarTaller } from './api-taller.ts';
import { AVISO_DE_EJEMPLO } from './logica-taller.ts';
import { SeccionesDelCotizador } from './marco.tsx';
import { PanelDeFormatos } from './taller-formatos.tsx';
import { PanelDeItems } from './taller-items.tsx';
import { PanelDeMaquinas } from './taller-maquinas.tsx';
import { PanelDeTarifas } from './taller-tarifas.tsx';
import { usePermisosDelCotizador } from './use-cotizador.ts';

function CargaDeEjemplo() {
  const [cargando, setCargando] = useState(false);
  async function cargar() {
    setCargando(true);
    const r = await sembrarTaller();
    setCargando(false);
    if (r.ok && 'datos' in r) {
      notificar(r.datos.mensaje, r.datos.sembrado ? 'exito' : 'info');
      await refrescarCotizador();
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }
  return (
    <div className="flex flex-col gap-2 rounded-control border border-borde bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-texto-suave">{AVISO_DE_EJEMPLO} Cargarlos solo funciona con el taller vacío.</p>
      <Boton cargando={cargando} onClick={() => void cargar()}>Cargar valores de ejemplo (Perú)</Boton>
    </div>
  );
}

/** Taller del Cotizador: tarifas, máquinas, formatos de pliego e ítems del cuadro. Quien no puede configurar solo los ve. */
export function PantallaTaller() {
  const { configurar } = usePermisosDelCotizador();
  const [activa, setActiva] = useState('tarifas');
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Taller" />
      <SeccionesDelCotizador />
      {configurar ? <CargaDeEjemplo /> : null}
      <Pestanas
        etiqueta="Taller del Cotizador"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { id: 'tarifas', etiqueta: 'Tarifas', contenido: <PanelDeTarifas puedeConfigurar={configurar} /> },
          { id: 'maquinas', etiqueta: 'Máquinas', contenido: <PanelDeMaquinas puedeConfigurar={configurar} /> },
          { id: 'formatos', etiqueta: 'Formatos', contenido: <PanelDeFormatos puedeConfigurar={configurar} /> },
          { id: 'items', etiqueta: 'Ítems del cuadro', contenido: <PanelDeItems puedeConfigurar={configurar} /> },
        ]}
      />
    </div>
  );
}
