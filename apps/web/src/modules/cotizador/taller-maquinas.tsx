import { useState } from 'react';
import type { MaquinaDelTallerDto } from '@capaz/shared';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { archivarMaquina, listarMaquinas } from './api-taller.ts';
import { medidasDe, mostrarDecimal, resumenDeEtapas } from './logica-taller.ts';
import { HojaDeMaquina } from './taller-hoja-maquina.tsx';
import { PanelDelTaller } from './taller-panel.tsx';

const columnas: Array<Columna<MaquinaDelTallerDto>> = [
  { id: 'nombre', titulo: 'Máquina', principal: true, celda: (m) => m.nombre },
  { id: 'formato', titulo: 'Formato máximo', celda: (m) => medidasDe(m.formatoMaxAnchoCm, m.formatoMaxAltoCm) },
  { id: 'trabajo', titulo: 'Pinza · sangrado · calle', celda: (m) => `${mostrarDecimal(m.pinzaCm)} · ${mostrarDecimal(m.sangradoCm)} · ${mostrarDecimal(m.calleCm)} cm` },
  { id: 'etapas', titulo: 'Mermas', celda: resumenDeEtapas },
];

/** Máquinas del taller: sus medidas de trabajo se copian al armar un cuadro. */
export function PanelDeMaquinas({ puedeConfigurar }: { puedeConfigurar: boolean }) {
  const [hoja, setHoja] = useState<{ maquina: MaquinaDelTallerDto | null } | null>(null);
  return (
    <>
      <PanelDelTaller<MaquinaDelTallerDto>
        clave="maquinas"
        etiqueta="máquinas"
        puedeConfigurar={puedeConfigurar}
        columnas={columnas}
        textoNuevo="Nueva máquina"
        vacioTitulo="Todavía no hay máquinas"
        vacioDescripcion="Registra tus máquinas con su formato máximo, pinza, sangrado, calle y mermas."
        cargar={async (estado, buscar, cursor) => listarMaquinas({ estado, ...(buscar !== '' && { buscar }) }, cursor)}
        onNuevo={() => setHoja({ maquina: null })}
        onEditar={(m) => setHoja({ maquina: m })}
        archivar={archivarMaquina}
      />
      <HojaDeMaquina abierto={hoja !== null} maquina={hoja?.maquina ?? null} alCerrar={() => setHoja(null)} />
    </>
  );
}
