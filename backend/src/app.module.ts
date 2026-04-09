import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { CheckpointsModule } from './checkpoints/checkpoints.module';
import { ScansModule } from './scans/scans.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 300 },  // 300 req/min globally
      { name: 'auth', ttl: 60000, limit: 10 },       // 10 req/min for auth (applied per controller)
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    CheckpointsModule,
    ScansModule,
    LeaderboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
