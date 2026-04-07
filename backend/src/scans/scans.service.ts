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

    // 2. Check event is active and within time window
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

    // Emit real-time event to all clients watching this event
    const team = await this.prisma.user.findUnique({ where: { id: teamId }, select: { username: true } });
    this.gateway.emitScanCreated(checkpoint.eventId, {
      teamId,
      teamUsername: team?.username ?? String(teamId),
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      points: checkpoint.pointValue + result.bonusAwarded,
      bonusAwarded: result.bonusAwarded,
      scannedAt: scan.scannedAt,
    });

    return result;
  }
}
