import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? '*', credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Client joins a room for a specific event via 'join' message
    void client;
  }

  handleDisconnect(client: Socket) {
    void client;
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() eventId: number, @ConnectedSocket() client: Socket) {
    client.join(`event:${eventId}`);
  }

  @SubscribeMessage('leave')
  handleLeave(@MessageBody() eventId: number, @ConnectedSocket() client: Socket) {
    client.leave(`event:${eventId}`);
  }

  emitScanCreated(eventId: number, payload: {
    teamId: number;
    teamUsername: string;
    checkpointId: number;
    checkpointName: string;
    points: number;
    bonusAwarded: number;
    scannedAt: Date;
  }) {
    this.server.to(`event:${eventId}`).emit('scan:created', { eventId, ...payload });
  }

  emitLocationUpdated(eventId: number, payload: {
    teamId: number;
    teamUsername: string;
    latitude: number;
    longitude: number;
  }) {
    this.server.to(`event:${eventId}`).emit('location:updated', { eventId, ...payload });
  }
}
