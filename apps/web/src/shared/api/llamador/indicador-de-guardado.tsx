import { useEffect, useState } from 'react';
import { textoDelIndicador } from './estado-del-llamador.ts';
import { useEstadoDelLlamador } from './almacen.ts';

const VIGENCIA_DEL_GUARDADO_MS = 2000;

/**
 * «Guardando… / Guardado / Sin conexión». El «Guardado» desaparece a los 2 s; cada llamada que termina lo
 * renueva. Va en el encabezado de la carcasa (solicitud de cambio: ese archivo no es de W5).
 */
export function IndicadorDeGuardado() {
  const estado = useEstadoDelLlamador();
  // Cuenta de llamadas terminadas cuyo «Guardado» ya venció: cada llamada nueva lo vuelve a encender.
  const [vencido, setVencido] = useState(-1);

  useEffect(() => {
    if (estado.terminadas === 0) return;
    const terminadas = estado.terminadas;
    const apagar = setTimeout(() => setVencido(terminadas), VIGENCIA_DEL_GUARDADO_MS);
    return () => clearTimeout(apagar);
  }, [estado.terminadas]);

  const vigente = vencido !== estado.terminadas;
  const texto = textoDelIndicador(estado, vigente);
  const tono = texto === 'Sin conexión' ? 'text-peligro' : texto === 'Guardado' ? 'text-exito' : 'text-texto-suave';
  return (
    <span role="status" aria-live="polite" className={`min-w-24 text-sm ${tono}`}>
      {texto ?? ''}
    </span>
  );
}
