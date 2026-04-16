import { Module } from '@nestjs/common';
import { CheckpointsService } from './checkpoints.service';
import { CheckpointsController } from './checkpoints.controller';

@Module({
  providers: [CheckpointsService],
  controllers: [CheckpointsController],
})
export class CheckpointsModule {}
