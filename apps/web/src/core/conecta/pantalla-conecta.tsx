import { useState } from 'react';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Pestanas } from '../../shared/ui/datos/pestanas.tsx';
import { SeccionClaves } from './seccion-claves.tsx';
import { SeccionConectores } from './seccion-conectores.tsx';
import { SeccionIntercambio } from './seccion-intercambio.tsx';
import { SeccionWebhooks } from './seccion-webhooks.tsx';

/** `/ajustes/conecta`: conectores, claves de API, webhooks de salida e importar/exportar. */
export function PantallaConecta() {
  const yo = useYo();
  const [activa, setActiva] = useState('conectores');
  const gestiona = !!yo && puede(yo, 'conexiones:gestionar');
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina titulo="Conecta tu empresa" migas={[{ texto: 'Ajustes' }, { texto: 'Conecta' }]} />
      <Pestanas
        etiqueta="Secciones de Conecta"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { id: 'conectores', etiqueta: 'Conectores', contenido: <SeccionConectores puedeGestionar={gestiona} /> },
          { id: 'claves', etiqueta: 'Claves de API', contenido: <SeccionClaves puedeGestionar={gestiona} /> },
          { id: 'webhooks', etiqueta: 'Webhooks', contenido: <SeccionWebhooks puedeGestionar={gestiona} /> },
          { id: 'datos', etiqueta: 'Importar y exportar', contenido: <SeccionIntercambio puedeImportar={!!yo && puede(yo, 'datos:importar')} puedeExportar={!!yo && puede(yo, 'datos:exportar')} /> },
        ]}
      />
    </div>
  );
}
