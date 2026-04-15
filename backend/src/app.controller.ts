import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    await this.prisma.$queryRawUnsafe('SELECT 1');
    return { status: 'ok' };
  }

  @Get('config')
  getConfig() {
    return {
      defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en-US'
    };
  }
}
