import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsScheduler {
  private readonly logger = new Logger(EventsScheduler.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async autoActivateEvents() {
    try {
      const now = new Date();

      // Find events that have a startTime in the past, are not yet active,
      // and have an endTime either unset or still in the future
      const toActivate = await this.prisma.event.findMany({
        where: {
          isActive: false,
          startTime: { lte: now },
          OR: [{ endTime: null }, { endTime: { gt: now } }],
        },
        select: { id: true, name: true },
      });

      for (const event of toActivate) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { isActive: true },
        });
        this.gateway.emitEventActivated(event.id);
        this.logger.log(
          `Auto-activated event "${event.name}" (id=${event.id})`,
        );
      }
    } catch (error: unknown) {
      const isConnectionError =
        error instanceof Prisma.PrismaClientInitializationError ||
        error instanceof Prisma.PrismaClientRustPanicError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code.startsWith('P10'));

      if (isConnectionError) {
        this.logger.warn('DB connection lost, reconnecting…');
        try {
          await this.prisma.$disconnect();
        } catch {}
        await this.prisma.$connect();
      } else {
        this.logger.error('Scheduler error', error);
      }
    }
  }
}
