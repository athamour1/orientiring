import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { EventsService } from './events.service';

const wsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

interface BufferedLocation {
  latitude: number;
  longitude: number;
  username: string;
  eventId: number | null;
}

@WebSocketGateway({
  cors: { origin: wsOrigins, credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  /** In-memory buffer: latest location per user, flushed to DB every 10s */
  private locationBuffer = new Map<number, BufferedLocation>();

  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => EventsService))
    private eventsService: EventsService,
  ) {}

  private getUserId(client: Socket): number | null {
    try {
      const token = client.handshake.auth?.token as string;
      if (!token) return null;
      const payload = this.jwtService.verify(token);
      return payload.sub;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    this.logger.log({ msg: 'Client connected', clientId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log({ msg: 'Client disconnected', clientId: client.id });
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() eventId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`event:${eventId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(
    @MessageBody() eventId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`event:${eventId}`);
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @MessageBody() data: { latitude: number; longitude: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.getUserId(client);
    if (!userId) return;

    // Look up user info only if not already buffered
    let entry = this.locationBuffer.get(userId);
    if (!entry) {
      const user = await this.eventsService.getUserInfo(userId);
      if (!user) return;
      entry = {
        latitude: data.latitude,
        longitude: data.longitude,
        username: user.username,
        eventId: user.eventId,
      };
    } else {
      entry.latitude = data.latitude;
      entry.longitude = data.longitude;
    }
    this.locationBuffer.set(userId, entry);

    // Emit WS update immediately (no DB needed for real-time display)
    if (entry.eventId) {
      this.emitLocationUpdated(entry.eventId, {
        teamId: userId,
        teamUsername: entry.username,
        latitude: data.latitude,
        longitude: data.longitude,
      });
    }
  }

  @Interval(10_000)
  async flushLocationBuffer() {
    if (this.locationBuffer.size === 0) return;

    const entries = new Map(this.locationBuffer);
    this.locationBuffer.clear();

    try {
      await this.eventsService.bulkUpsertLocations(entries);
    } catch (err) {
      this.logger.error('Failed to flush location buffer', err);
      // Re-add entries so they are retried on next flush
      for (const [userId, loc] of entries) {
        if (!this.locationBuffer.has(userId)) {
          this.locationBuffer.set(userId, loc);
        }
      }
    }
  }

  emitScanCreated(
    eventId: number,
    payload: {
      teamId: number;
      teamUsername: string;
      checkpointId: number;
      checkpointName: string;
      points: number;
      bonusAwarded: number;
      scannedAt: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}`)
      .emit('scan:created', { eventId, ...payload });
  }

  emitStatsUpdated(
    eventId: number,
    payload: {
      checkpoints: { id: number; _count: { scans: number } }[];
      teamCount: number;
    },
  ) {
    this.server
      .to(`event:${eventId}`)
      .emit('stats:updated', { eventId, ...payload });
  }

  emitFirstFinish(
    eventId: number,
    payload: {
      teamId: number;
      teamUsername: string;
      bonus: number;
      finishedAt: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}`)
      .emit('first:finish', { eventId, ...payload });
  }

  emitLocationUpdated(
    eventId: number,
    payload: {
      teamId: number;
      teamUsername: string;
      latitude: number;
      longitude: number;
    },
  ) {
    this.server
      .to(`event:${eventId}`)
      .emit('location:updated', { eventId, ...payload });
  }

  emitEventActivated(eventId: number) {
    this.server.to(`event:${eventId}`).emit('event:activated', { eventId });
  }

  emitEventEnded(eventId: number) {
    this.server.to(`event:${eventId}`).emit('event:ended', { eventId });
  }

  emitLeaderboardUpdated(eventId: number, payload: any) {
    this.server
      .to(`event:${eventId}`)
      .emit('leaderboard:updated', { eventId, ...payload });
  }
}
