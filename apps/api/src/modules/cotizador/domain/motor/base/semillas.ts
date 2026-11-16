import type { SemillaDeEmpresa } from './empresa.js'
import { semillaEsPE } from './semilla-es-pe.js'

/**
 * Las semillas disponibles, por código de país. Al crear una empresa se elige la de su país
 * (ADR-15). Este índice es la única puerta: el resto del código no nombra ningún país.
 */
export const SEMILLAS: Readonly<Record<string, SemillaDeEmpresa>> = { PE: semillaEsPE }

/** La semilla con la que arranca el repositorio en memoria, mientras no exista el alta de empresas (PRP-002). */
export const SEMILLA_POR_DEFECTO: SemillaDeEmpresa = semillaEsPE
