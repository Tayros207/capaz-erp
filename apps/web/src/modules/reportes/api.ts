import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Las pantallas de reportes solo hablan con el servidor por herramientas tipadas.
export type Periodo = EntradaDe<'reportes_panel'>;

export const cargarPanel = (periodo: Periodo) => llamar('reportes_panel', periodo);
export const exportarPanel = (periodo: Periodo) => llamar('reportes_exportar_csv', periodo);
