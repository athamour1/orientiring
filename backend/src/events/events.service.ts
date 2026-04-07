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

  getLogs(eventId: number, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    return this.prisma.scan.findMany({
      where: { checkpoint: { eventId } },
      include: {
        team: { select: { id: true, username: true } },
        checkpoint: { select: { id: true, name: true, pointValue: true } },
      },
      orderBy: { scannedAt: 'desc' },
      skip,
      take: limit,
    });
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
