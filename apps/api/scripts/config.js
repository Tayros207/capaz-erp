export const ROLES = ['capaz_owner', 'capaz_auth', 'capaz_app', 'capaz_sistema'];
function cargarEnv() {
    try {
        process.loadEnvFile(new URL('../../../.env', import.meta.url));
    }
    catch {
    }
}
export function variable(nombre) {
    cargarEnv();
    const valor = process.env[nombre];
    if (!valor)
        throw new Error(`Falta ${nombre} en .env (ver .env.example).`);
    return valor;
}
export function credencialDe(url, esperado) {
    const u = new URL(url);
    const usuario = decodeURIComponent(u.username);
    const contrasena = decodeURIComponent(u.password);
    if (esperado && usuario !== esperado)
        throw new Error(`La URL de ${esperado} usa el usuario «${usuario}».`);
    if (!/^[A-Za-z0-9_-]{12,}$/.test(contrasena)) {
        throw new Error(`La contraseña de ${usuario} debe ser alfanumérica simple y de 12 caracteres o más.`);
    }
    return { usuario, contrasena };
}
export function conBase(url, base) {
    const u = new URL(url);
    u.pathname = `/${base}`;
    return u.toString();
}
export function baseDe(url) {
    return new URL(url).pathname.replace(/^\//, '');
}
export const urlDelDueno = () => variable('DATABASE_URL_OWNER');
export const urlDeAdmin = () => variable('DATABASE_URL_ADMIN');
export function credencialesDeRoles() {
    return {
        capaz_owner: credencialDe(variable('DATABASE_URL_OWNER'), 'capaz_owner'),
        capaz_auth: credencialDe(variable('DATABASE_URL_AUTH'), 'capaz_auth'),
        capaz_app: credencialDe(variable('DATABASE_URL_APP'), 'capaz_app'),
        capaz_sistema: credencialDe(variable('DATABASE_URL_SISTEMA'), 'capaz_sistema'),
    };
}
//# sourceMappingURL=config.js.map