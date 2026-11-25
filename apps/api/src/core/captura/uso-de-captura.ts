import { conPuntoDeGuardado, type Transaccion } from '../../infra/database/con-empresa.js';
import { gastoDelMes, leerConfiguracion, registrarUso, zonaDeLaEmpresa, type UsoParaGuardar } from '../agente/repositorio-de-uso.js';

// El presupuesto y el uso de la extracción del dictado. Es el MISMO tope mensual del asistente: `core.uso` suma todo lo que gasta la
// empresa con modelos (origen `agente`, `titulo` o `captura`). Se inyecta para que las pruebas unitarias no necesiten base.

export type CuentasDeUso = {
  /** ¿Queda presupuesto este mes? `topePorOmision` en millonésimas de dólar; la empresa puede haber fijado el suyo. */
  hayPresupuesto(tx: Transaccion, topePorOmision: number): Promise<boolean>;
  registrar(tx: Transaccion, uso: UsoParaGuardar): Promise<void>;
};

/**
 * En la base, dentro de la transacción de quien dicta. Cada paso va en un punto de guardado: si falla, se deshace solo él y la
 * transacción sigue sana para que el intérprete termine con sus reglas.
 */
export const cuentasEnLaBase: CuentasDeUso = {
  hayPresupuesto: (tx, topePorOmision) =>
    conPuntoDeGuardado(tx, async (punto) => {
      const tope = (await leerConfiguracion(punto))?.topeMensualMicrousd ?? topePorOmision;
      const gasto = await gastoDelMes(punto, new Date(), await zonaDeLaEmpresa(punto));
      return gasto < tope;
    }),
  registrar: (tx, uso) => conPuntoDeGuardado(tx, (punto) => registrarUso(punto, uso)),
};
