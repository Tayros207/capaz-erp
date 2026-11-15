import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import type { DatabaseService, DatabaseStatus } from '../database/database.service.js';

const baseFalsa = (estado: DatabaseStatus) =>
  ({ ping: async () => estado }) as unknown as DatabaseService;

describe('HealthController', () => {
  it('informa la base como activa', async () => {
    const r = await new HealthController(baseFalsa('up')).check();
    expect(r.status).toBe('ok');
    expect(r.database).toBe('up');
  });

  it('informa la base como caída sin fallar', async () => {
    const r = await new HealthController(baseFalsa('down')).check();
    expect(r.database).toBe('down');
  });

});
