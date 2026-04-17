import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // PgBouncer handles connection pooling in production.
    // Keep a small Prisma-side pool to avoid opening too many connections to PgBouncer.
    const url = process.env.DATABASE_URL ?? '';
    const separator = url.includes('?') ? '&' : '?';
    const pooledUrl = url.includes('connection_limit')
      ? url
      : `${url}${separator}connection_limit=10&pool_timeout=15`;

    super({ datasourceUrl: pooledUrl });
    this.logger.log('Prisma pool: connection_limit=10, pool_timeout=15');
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
