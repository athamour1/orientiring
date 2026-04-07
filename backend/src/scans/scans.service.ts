import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ScansService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  async processScan(teamId: number, qrSecretString: string) {
    // 1. Find checkpoint
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { qrSecretString },
      include: { event: true },
    });

    if (!checkpoint) {
      throw new BadRequestException('Invalid QR code');
    }

    // 2. Verify the team belongs to this event
    const teamMeta = await this.prisma.user.findUnique({ where: { id: teamId }, select: { eventId: true } });
    if (teamMeta?.eventId && teamMeta.eventId !== checkpoint.eventId) {
      throw new BadRequestException('This checkpoint does not belong to your event');
    }

    // 3. Check event is active and within time window
    if (!checkpoint.event.isActive) {
      throw new BadRequestException('Event is not currently active');
    }
    const now = new Date();
    if (checkpoint.event.startTime && now < checkpoint.event.startTime) {
      throw new BadRequestException('Event has not started yet');
    }
    if (checkpoint.event.endTime && now > checkpoint.event.endTime) {
      throw new BadRequestException('Event has already ended');
    }

    // 3. Check for duplicate scan
    const existingScan = await this.prisma.scan.findUnique({
      where: { teamId_checkpointId: { teamId, checkpointId: checkpoint.id } },
    });
    if (existingScan) {
      throw new ConflictException('Checkpoint already scanned by your team');
    }

    // 4. Check if this team is first to scan (for bonus)
    const isFirst = checkpoint.bonusForFirst > 0
      ? (await this.prisma.scan.count({ where: { checkpointId: checkpoint.id } })) === 0
      : false;

    // 5. Record the scan
    const scan = await this.prisma.scan.create({
      data: { teamId, checkpointId: checkpoint.id },
      include: { checkpoint: true },
    });

    const result = { ...scan, isFirst, bonusAwarded: isFirst ? checkpoint.bonusForFirst : 0 };

    // 6. Check if this team just finished all checkpoints first
    if (checkpoint.event.firstFinishBonus > 0 && !checkpoint.event.firstFinishBonusAwardedToId) {
      const totalCheckpoints = await this.prisma.checkpoint.count({ where: { eventId: checkpoint.eventId } });
      const teamScans = await this.prisma.scan.count({ where: { teamId, checkpoint: { eventId: checkpoint.eventId } } });
      if (teamScans >= totalCheckpoints) {
        await this.prisma.event.update({
          where: { id: checkpoint.eventId },
          data: { firstFinishBonusAwardedToId: teamId },
        });
      }
    }

    // Emit real-time event to all clients watching this event
    const [team, updatedCheckpoints, teamCount] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: teamId }, select: { username: true } }),
      this.prisma.checkpoint.findMany({
        where: { eventId: checkpoint.eventId },
        include: { _count: { select: { scans: true } } },
      }),
      this.prisma.user.count({ where: { eventId: checkpoint.eventId } }),
    ]);

    this.gateway.emitScanCreated(checkpoint.eventId, {
      teamId,
      teamUsername: team?.username ?? String(teamId),
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      points: checkpoint.pointValue + result.bonusAwarded,
      bonusAwarded: result.bonusAwarded,
      scannedAt: scan.scannedAt,
    });

    this.gateway.emitStatsUpdated(checkpoint.eventId, {
      checkpoints: updatedCheckpoints,
      teamCount,
    });

    return result;
  }
}
