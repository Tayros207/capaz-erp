import { describe, expect, it } from 'vitest';
import { rutaDeAutenticacionPermitida as ok } from './rutas-permitidas.js';

describe('lista blanca de rutas de autenticación', () => {
  it.each([
    ['POST', '/sign-up/email'],
    ['POST', '/sign-in/email'],
    ['POST', '/sign-out'],
    ['GET', '/get-session'],
    ['POST', '/change-password'],
    ['POST', '/reset-password'],
    ['GET', '/reset-password/abc123_-X'],
    ['GET', '/organization/list'],
    ['POST', '/organization/set-active'],
    ['GET', '/organization/get-invitation?id=1'],
    ['POST', '/organization/accept-invitation'],
    ['post', '/sign-in/email/'],
  ])('permite %s %s', (m, r) => expect(ok(m, r)).toBe(true));

  it.each([
    ['POST', '/organization/create'],
    ['POST', '/organization/delete'],
    ['POST', '/organization/invite-member'],
    ['POST', '/organization/remove-member'],
    ['POST', '/organization/update-member-role'],
    ['POST', '/organization/leave'],
    ['POST', '/change-email'],
    ['POST', '/delete-user'],
    ['POST', '/request-password-reset'],
    ['POST', '/update-user'],
    ['POST', '/list-sessions'],
    ['GET', '/sign-in/email'],
    ['GET', '/organization/list/../create'],
    ['POST', '/sign-in/email/extra'],
    ['DELETE', '/sign-out'],
    ['GET', '/'],
  ])('rechaza %s %s', (m, r) => expect(ok(m, r)).toBe(false));
});
