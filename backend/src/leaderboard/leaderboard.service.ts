import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 8000; // 8 seconds — slightly longer than the 5s client poll

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  private cache = new Map<number, { data: any; expiresAt: number }>();

  async getLeaderboard(eventId: number) {
    const cached = this.cache.get(eventId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const [scans, event] = await Promise.all([
      this.prisma.scan.findMany({
        where: { checkpoint: { eventId } },
        include: { team: true, checkpoint: true },
      }),
      this.prisma.event.findUnique({
        where: { id: eventId },
        select: { name: true, description: true, firstFinishBonus: true, firstFinishBonusAwardedToId: true, startTime: true, endTime: true },
      }),
    ]);

    const scoresMap = new Map<number, { teamName: string; score: number }>();
    for (const scan of scans) {
      if (!scoresMap.has(scan.teamId)) {
        scoresMap.set(scan.teamId, { teamName: scan.team.username, score: 0 });
      }
      scoresMap.get(scan.teamId)!.score += scan.checkpoint.pointValue;
    }

    // Per-checkpoint first-scan bonus: find the earliest scan per checkpoint
    // and credit its team with the bonusForFirst value
    const byCheckpoint = new Map<number, { teamId: number; scannedAt: Date; bonus: number }>();
    for (const scan of scans) {
      if (!scan.checkpoint.bonusForFirst) continue;
      const cur = byCheckpoint.get(scan.checkpointId);
      if (!cur || scan.scannedAt < cur.scannedAt) {
        byCheckpoint.set(scan.checkpointId, { teamId: scan.teamId, scannedAt: scan.scannedAt, bonus: scan.checkpoint.bonusForFirst });
      }
    }
    for (const { teamId, bonus } of byCheckpoint.values()) {
      const entry = scoresMap.get(teamId);
      if (entry) entry.score += bonus;
    }

    if (event?.firstFinishBonus && event.firstFinishBonusAwardedToId) {
      const winner = scoresMap.get(event.firstFinishBonusAwardedToId);
      if (winner) winner.score += event.firstFinishBonus;
    }

    const leaderboard = Array.from(scoresMap.values()).sort((a, b) => b.score - a.score);
    const result = {
      eventName: event?.name ?? 'Event',
      eventDescription: event?.description ?? '',
      startTime: event?.startTime ?? null,
      endTime: event?.endTime ?? null,
      leaderboard,
    };

    this.cache.set(eventId, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
}
