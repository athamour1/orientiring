import { Injectable, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  async processScan(teamId: number, qrSecretString: string) {
    // Batch 1: Fetch checkpoint + team in parallel (saves 1 round trip)
    const [checkpoint, team] = await Promise.all([
      this.prisma.checkpoint.findUnique({
        where: { qrSecretString },
        include: { event: true },
      }),
      this.prisma.user.findUnique({
        where: { id: teamId },
        select: { eventId: true, username: true },
      }),
    ]);

    if (!checkpoint) {
      this.logger.warn({ msg: 'Invalid QR scan', teamId });
      throw new BadRequestException('Invalid QR code');
    }

    if (team?.eventId && team.eventId !== checkpoint.eventId) {
      throw new BadRequestException('This checkpoint does not belong to your event');
    }

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

    // Batch 2: Duplicate check + first-to-scan count in parallel (saves 1 round trip)
    const [existingScan, priorScanCount] = await Promise.all([
      this.prisma.scan.findUnique({
        where: { teamId_checkpointId: { teamId, checkpointId: checkpoint.id } },
      }),
      checkpoint.bonusForFirst > 0
        ? this.prisma.scan.count({ where: { checkpointId: checkpoint.id } })
        : Promise.resolve(1),
    ]);

    if (existingScan) {
      this.logger.warn({ msg: 'Duplicate scan attempt', teamId, checkpointId: checkpoint.id });
      throw new ConflictException('Checkpoint already scanned by your team');
    }

    const isFirst = checkpoint.bonusForFirst > 0 && priorScanCount === 0;

    // Create the scan
    const scan = await this.prisma.scan.create({
      data: { teamId, checkpointId: checkpoint.id },
      include: { checkpoint: true },
    });

    const result = { ...scan, isFirst, bonusAwarded: isFirst ? checkpoint.bonusForFirst : 0 };
    this.logger.log({ msg: 'Scan recorded', teamId, checkpointId: checkpoint.id, checkpointName: checkpoint.name, isFirst });

    // Batch 3: All post-create reads in parallel (saves 3 round trips)
    // - Stats for WebSocket broadcast
    // - First-finisher check (teamScans count) when applicable
    const needsFirstFinishCheck =
      checkpoint.event.firstFinishBonus > 0 && !checkpoint.event.firstFinishBonusAwardedToId;

    const [updatedCheckpoints, teamCount, ...extra] = await Promise.all([
      this.prisma.checkpoint.findMany({
        where: { eventId: checkpoint.eventId },
        include: { _count: { select: { scans: true } } },
      }),
      this.prisma.user.count({ where: { eventId: checkpoint.eventId } }),
      ...(needsFirstFinishCheck
        ? [this.prisma.scan.count({ where: { teamId, checkpoint: { eventId: checkpoint.eventId } } })]
        : []),
    ]);

    // Check first finisher using checkpoint count from the already-fetched list
    let isFirstFinisher = false;
    if (needsFirstFinishCheck) {
      const teamScans = extra[0] as number;
      if (teamScans >= updatedCheckpoints.length) {
        await this.prisma.event.update({
          where: { id: checkpoint.eventId },
          data: { firstFinishBonusAwardedToId: teamId },
        });
        isFirstFinisher = true;
      }
    }

    const teamUsername = team?.username ?? String(teamId);

    this.gateway.emitScanCreated(checkpoint.eventId, {
      teamId,
      teamUsername,
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

    if (isFirstFinisher) {
      this.gateway.emitFirstFinish(checkpoint.eventId, {
        teamId,
        teamUsername,
        bonus: checkpoint.event.firstFinishBonus,
        finishedAt: scan.scannedAt,
      });
    }

    return result;
  }
}
