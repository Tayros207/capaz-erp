import { SetMetadata } from '@nestjs/common';

/** Ruta que no exige sesión (salud, etc.). Todo lo demás la exige. */
export const ES_PUBLICA = 'capaz:publica';
export const Publica = () => SetMetadata(ES_PUBLICA, true);

/** Ruta que exige una empresa activa: sin ella responde `sin_empresa`. */
export const EXIGE_EMPRESA = 'capaz:exige-empresa';
export const RequiereEmpresa = () => SetMetadata(EXIGE_EMPRESA, true);

/** Ruta que exige poder ENTRAR al módulo: si la empresa no lo tiene o no se lo asignaron, `modulo_no_disponible`. */
export const MODULO_REQUERIDO = 'capaz:modulo';
export const RequiereModulo = (codigo: string) => SetMetadata(MODULO_REQUERIDO, codigo);

/** Ruta que exige un permiso `recurso:accion`: si falta, `sin_permiso`. */
export const PERMISO_REQUERIDO = 'capaz:permiso';
export const RequierePermiso = (permiso: string) => SetMetadata(PERMISO_REQUERIDO, permiso);
