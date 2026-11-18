import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Llamadas de «¿Cuánto le cobramos?». Todo va por el nombre de la herramienta: `core` no importa de `modules`.

export const CLAVE_PRECIOS = ['precios'] as const;

export const consultarPrecioAnterior = (args: EntradaDe<'precio_anterior_consultar'>) => llamar('precio_anterior_consultar', args);
