import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { EventsGateway } from './events.gateway';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  create(data: CreateEventDto) {
    return this.prisma.event.create({ data });
  }

  findAll() {
    return this.prisma.event.findMany({ include: { checkpoints: true } });
  }

  findOne(id: number) {
    return this.prisma.event.findUnique({ where: { id }, include: { checkpoints: true } });
  }

  update(id: number, data: UpdateEventDto) {
    return this.prisma.event.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.event.delete({ where: { id } });
  }

  findActiveEvent() {
    return this.prisma.event.findFirst({
      where: { isActive: true },
      include: { checkpoints: true },
    });
  }

  async getLogs(eventId: number, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [scans, firstScans] = await Promise.all([
      this.prisma.scan.findMany({
        where: { checkpoint: { eventId } },
        include: {
          team: { select: { id: true, username: true } },
          checkpoint: { select: { id: true, name: true, pointValue: true, bonusForFirst: true } },
        },
        orderBy: { scannedAt: 'desc' },
        skip,
        take: limit,
      }),
      // For each checkpoint find which team scanned it first
      this.prisma.scan.findMany({
        where: { checkpoint: { eventId, bonusForFirst: { gt: 0 } } },
        orderBy: { scannedAt: 'asc' },
        distinct: ['checkpointId'],
        select: { id: true, checkpointId: true },
      }),
    ]);

    const firstScanIds = new Set(firstScans.map(s => s.id));
    return scans.map(s => ({
      ...s,
      bonusAwarded: firstScanIds.has(s.id) ? s.checkpoint.bonusForFirst : 0,
    }));
  }

  async getStats(eventId: number) {
    const [checkpoints, teamCount] = await Promise.all([
      this.prisma.checkpoint.findMany({
        where: { eventId },
        include: { _count: { select: { scans: true } } },
      }),
      this.prisma.user.count({ where: { eventId } }),
    ]);
    return { checkpoints, teamCount };
  }

  async getDashboardStats() {
    const [teamCounts, checkpointCounts, scanCounts] = await Promise.all([
      this.prisma.user.groupBy({ by: ['eventId'], _count: { _all: true } }),
      this.prisma.checkpoint.groupBy({ by: ['eventId'], _count: { _all: true } }),
      this.prisma.scan.groupBy({ by: ['checkpointId'], _count: { _all: true } }),
    ]);

    // Map scanCounts to eventId via checkpoint lookup
    const checkpointEventMap = await this.prisma.checkpoint.findMany({
      select: { id: true, eventId: true },
    });
    const cpEventId = new Map(checkpointEventMap.map(c => [c.id, c.eventId]));
    const scansByEvent = new Map<number, number>();
    for (const s of scanCounts) {
      const evId = cpEventId.get(s.checkpointId);
      if (evId) scansByEvent.set(evId, (scansByEvent.get(evId) ?? 0) + s._count._all);
    }

    const result: Record<number, { teamCount: number; checkpointCount: number; scanCount: number }> = {};
    for (const row of teamCounts) result[row.eventId] = { teamCount: row._count._all, checkpointCount: 0, scanCount: 0 };
    for (const row of checkpointCounts) {
      if (!result[row.eventId]) result[row.eventId] = { teamCount: 0, checkpointCount: 0, scanCount: 0 };
      result[row.eventId].checkpointCount = row._count._all;
    }
    for (const [evId, count] of scansByEvent) {
      if (!result[evId]) result[evId] = { teamCount: 0, checkpointCount: 0, scanCount: 0 };
      result[evId].scanCount = count;
    }
    return result;
  }

  async getTeamLocations(eventId: number) {
    return this.prisma.teamLocation.findMany({
      where: { team: { eventId } },
      include: { team: { select: { id: true, username: true } } },
    });
  }

  async getActiveEventForTeam(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let activeEvent: any = null;

    if (user?.eventId) {
      const event = await this.findOne(user.eventId);
      if (event?.isActive) activeEvent = event;
    }
    if (!activeEvent) {
      activeEvent = await this.findActiveEvent();
    }
    if (!activeEvent) return null;

    const scans = await this.prisma.scan.findMany({
      where: { teamId: userId, checkpoint: { eventId: activeEvent.id } },
    });

    return { ...activeEvent, scannedCheckpointIds: scans.map((s: any) => s.checkpointId) };
  }

  async upsertTeamLocation(userId: number, dto: UpdateLocationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, eventId: true },
    });

    if (!user) return null;

    const [location] = await this.prisma.$transaction([
      this.prisma.teamLocation.upsert({
        where: { teamId: userId },
        create: { teamId: userId, latitude: dto.latitude, longitude: dto.longitude },
        update: { latitude: dto.latitude, longitude: dto.longitude },
      }),
      this.prisma.teamRoute.create({
        data: { teamId: userId, latitude: dto.latitude, longitude: dto.longitude },
      }),
    ]);

    if (user?.eventId) {
      this.gateway.emitLocationUpdated(user.eventId, {
        teamId: userId,
        teamUsername: user.username,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    }

    return location;
  }

  getTeamRoute(teamId: number) {
    return this.prisma.teamRoute.findMany({
      where: { teamId },
      orderBy: { recordedAt: 'asc' },
      select: { latitude: true, longitude: true, recordedAt: true },
    });
  }
}
