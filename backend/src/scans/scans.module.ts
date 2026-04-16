import { Module } from '@nestjs/common';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { EventsModule } from '../events/events.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [EventsModule, LeaderboardModule],
  providers: [ScansService],
  controllers: [ScansController],
})
export class ScansModule {}
