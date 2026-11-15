import { Controller, Get, Inject } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@capaz/shared';
import { Publica } from '../http/decoradores.js';
import { DatabaseService } from '../database/database.service.js';

@Publica()
@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const database = await this.db.ping();
    // La respuesta sale validada con el mismo contrato que usa la web.
    return healthResponseSchema.parse({
      status: 'ok',
      database,
      timestamp: new Date().toISOString(),
    });
  }
}
