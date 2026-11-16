import type { Ayuda } from '@capaz/shared';

// Ayuda de cada herramienta de la consola (alimenta «qué puedo decir» y al asistente).

const a = (
  titulo: string,
  paraQueSirve: string,
  cuandoUsarla: string,
  campos: Array<[string, string, string]>,
  ejemploTecleado: string,
  ejemploHablado: string,
  erroresComunes: string[],
  relacionadas: string[] = [],
): Ayuda => ({
  titulo,
  paraQueSirve,
  cuandoUsarla,
  campos: campos.map(([nombre, queSeAnota, ejemplo]) => ({ nombre, queSeAnota, ejemplo })),
  ejemploTecleado,
  ejemploHablado,
  erroresComunes,
  relacionadas,
});

const EMPRESA: [string, string, string] = ['empresa', 'El identificador de la empresa.', 'a1b2c3d4'];
const MODULO: [string, string, string] = ['modulo', 'El código del módulo.', 'crm'];
const MOTIVO: [string, string, string] = ['motivo', 'Por qué se hace (queda en el historial).', 'mora de dos meses'];

export const AYUDAS = {
  empresasListar: a('Listar empresas', 'Muestra las empresas clientes con el estado de sus módulos.', 'Para ver quién contrata qué y qué vence pronto.', [['texto', 'Parte del nombre de la empresa.', 'imprenta']], 'empresas imprenta', 'muéstrame las empresas', ['Buscar por un texto que no está en el nombre.'], ['plataforma_empresas_ver']),
  empresaVer: a('Ver una empresa', 'Muestra la ficha de contratación: módulos, plan, precio, vigencia, usuarios, última actividad e historial.', 'Antes de cambiar el contrato de una empresa.', [EMPRESA], 'ver empresa a1b2c3d4', 'abre la ficha de esa empresa', ['Pedir datos de negocio de la empresa: la consola no los ve.'], ['plataforma_empresas_listar', 'plataforma_contrato_fijar']),
  empresaCrear: a('Crear una empresa', 'Da de alta una empresa nueva con una persona ya registrada como dueña, y en el mismo paso le aplica un plan o los módulos indicados. Queda con la cuenta activa. No envía ningún correo.', 'Cuando firma un cliente nuevo.', [['nombre', 'El nombre de la empresa.', 'Imprenta Andina'], ['correoDelDueno', 'El correo de la persona dueña (ya registrada).', 'ana@andina.pe'], ['plan', 'Opcional: código de un plan activo.', 'basico'], ['modulos', 'Opcional: módulos con días de prueba, además del plan.', 'crm en prueba 15 días']], 'crear empresa Imprenta Andina con ana@andina.pe y el plan basico', 'crea la empresa Imprenta Andina para Ana con el plan básico', ['La persona todavía no se registró.', 'Pedir un módulo en construcción: se rechaza.', 'Esperar que se envíe una invitación por correo: no se envía.', 'Pedir un plan que no existe o está inactivo.'], ['plataforma_modulos_listar', 'plataforma_planes_listar']),
  moduloActivar: a('Activar un módulo', 'Da a una empresa un módulo, activo o en prueba por unos días.', 'Al contratar o probar un módulo.', [EMPRESA, MODULO, ['pruebaDias', 'Días de prueba; sin ellos queda activo.', '15'], MOTIVO], 'activar crm a la empresa a1b2c3d4 por 15 días', 'dale el CRM a esa empresa quince días de prueba', ['El módulo depende de otro que la empresa no tiene.'], ['plataforma_modulo_suspender', 'plataforma_contrato_fijar']),
  moduloSuspender: a('Suspender un módulo', 'Pausa un módulo sin darlo de baja: la empresa lo ve pero no escribe.', 'Por mora u otro motivo temporal.', [EMPRESA, MODULO, MOTIVO], 'suspender crm de a1b2c3d4 por mora', 'suspende el CRM de esa empresa', ['El módulo no está activo ni en prueba.'], ['plataforma_modulo_reactivar']),
  moduloDarDeBaja: a('Dar de baja un módulo', 'El módulo queda en solo lectura; los datos nunca se borran.', 'Cuando el cliente cancela.', [EMPRESA, MODULO, MOTIVO], 'dar de baja crm de a1b2c3d4', 'da de baja el CRM de esa empresa', ['Otro módulo activo depende de este.'], ['plataforma_modulo_reactivar']),
  moduloReactivar: a('Reactivar un módulo', 'Devuelve a activo un módulo suspendido o en baja.', 'Cuando el cliente regulariza o vuelve.', [EMPRESA, MODULO], 'reactivar crm de a1b2c3d4', 'reactiva el CRM de esa empresa', ['El módulo no estaba suspendido ni en baja.'], ['plataforma_modulo_suspender', 'plataforma_modulo_dar_de_baja']),
  contratoFijar: a('Fijar el contrato', 'Anota plan, precio acordado, vigencia y límite de usuarios de un módulo de una empresa.', 'Al acordar condiciones o dar un mejor precio.', [EMPRESA, MODULO, ['plan', 'Código del plan.', 'basico'], ['precioAcordadoCentimos', 'Precio mensual en céntimos.', '9900'], ['vigenteHasta', 'Fecha de fin del acuerdo.', '2027-12-31T00:00:00Z'], ['maxUsuarios', 'Usuarios permitidos.', '5']], 'fijar precio 9900 céntimos al crm de a1b2c3d4', 'ponle ese precio al CRM de esa empresa', ['El plan no existe.', 'No mandar ningún dato.'], ['plataforma_planes_listar']),
  planesListar: a('Listar planes', 'Muestra el catálogo de planes con sus módulos y precio.', 'Para elegir un plan o revisar precios.', [], 'planes', 'muéstrame los planes', ['Ninguno.'], ['plataforma_planes_guardar']),
  planesGuardar: a('Guardar un plan', 'Crea o cambia un plan: módulos incluidos, precio mensual y usuarios.', 'Al definir o ajustar un paquete.', [['codigo', 'Código corto del plan.', 'basico'], ['nombre', 'Nombre visible.', 'Básico'], ['precioCentimos', 'Precio mensual en céntimos.', '9900'], ['modulos', 'Módulos que incluye.', 'registro, crm']], 'guardar plan basico a 9900 con registro y crm', 'crea el plan básico', ['Un módulo del plan no existe.'], ['plataforma_planes_listar']),
  solicitudesListar: a('Listar solicitudes', 'Muestra lo que las empresas pidieron contratar.', 'Para atender pedidos de módulos.', [['estado', 'pendiente, atendida, descartada o todas.', 'pendiente']], 'solicitudes pendientes', 'qué me han pedido', ['Ninguno.'], ['plataforma_solicitud_atender']),
  solicitudAtender: a('Atender una solicitud', 'Marca una solicitud como atendida o descartada.', 'Después de activar el módulo pedido, o de decidir no hacerlo.', [['id', 'El identificador de la solicitud.', '0190…'], ['resultado', 'atendida o descartada.', 'atendida']], 'atender solicitud 0190… como atendida', 'marca esa solicitud como atendida', ['La solicitud ya se resolvió.'], ['plataforma_solicitudes_listar', 'plataforma_modulo_activar']),
  restablecerContrasena: a('Restablecer una contraseña', 'Genera un enlace de un solo uso para que una persona elija nueva contraseña.', 'Cuando alguien perdió su acceso y no hay correo automático.', [['correo', 'El correo de la cuenta.', 'ana@andina.pe']], 'restablecer contraseña de ana@andina.pe', 'dame el enlace para que Ana cambie su contraseña', ['La cuenta no existe.', 'El enlace se muestra una sola vez: si se pierde, genera otro.']),
  cuentaPausar: a('Pausar la cuenta', 'La empresa entera pasa a solo lectura: entra y ve todo, pero no escribe en ningún módulo. No se borra nada.', 'Por mora u otro motivo temporal de toda la empresa.', [EMPRESA, MOTIVO], 'pausar la cuenta de a1b2c3d4 por mora de dos meses', 'pausa la cuenta de esa empresa por mora', ['Dejar el motivo vacío o de menos de 5 letras.', 'Pausar la cuenta de la propia plataforma: se rechaza.', 'Usarla para quitar un solo módulo: para eso está dar de baja el módulo.'], ['plataforma_cuenta_reactivar', 'plataforma_modulo_suspender']),
  cuentaDarDeBaja: a('Dar de baja la cuenta', 'La empresa queda en solo lectura y se marca que la relación terminó. Los datos nunca se borran.', 'Cuando el cliente cancela todo el servicio.', [EMPRESA, MOTIVO], 'dar de baja la cuenta de a1b2c3d4 por cancelación', 'da de baja la cuenta de esa empresa, cancela el servicio', ['Pensar que borra los datos: no se borra nada.', 'Dejar el motivo vacío o de menos de 5 letras.', 'Darla de baja si solo cancela un módulo.'], ['plataforma_cuenta_reactivar', 'plataforma_modulo_dar_de_baja']),
  cuentaReactivar: a('Reactivar la cuenta', 'Devuelve la cuenta a activa; los módulos conservan su propio estado.', 'Cuando el cliente regulariza o vuelve.', [EMPRESA, ['motivo', 'Opcional: por qué se reactiva.', 'pagó la deuda']], 'reactivar la cuenta de a1b2c3d4', 'reactiva la cuenta de esa empresa', ['Esperar que reactive también un módulo suspendido: esos se reactivan aparte.'], ['plataforma_cuenta_pausar', 'plataforma_modulo_reactivar']),
  modulosListar: a('Listar módulos', 'Muestra el catálogo de módulos con su nombre, familia, descripción y si ya están terminados.', 'Para saber qué se puede dar a una empresa o poner en un plan.', [], 'módulos', 'qué módulos tenemos', ['Buscar aquí lo que contrató una empresa: eso está en su ficha.'], ['plataforma_planes_guardar', 'plataforma_empresas_crear']),
  vencimientosListar: a('Ver vencimientos', 'Lista las pruebas y los contratos que vencen pronto, con los ingresos mensuales acordados por empresa.', 'Para que no se pase ninguna prueba ni renovación.', [['dias', 'Plazo en días, de 1 a 90 (por defecto 14).', '30']], 'vencimientos en 30 días', 'qué vence este mes', ['Pedir más de 90 días.', 'Esperar datos de negocio de la empresa: solo hay contratos y cifras acordadas.'], ['plataforma_empresas_ver', 'plataforma_contrato_fijar']),
} satisfies Record<string, Ayuda>;
