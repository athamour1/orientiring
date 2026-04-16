import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Res,
} from '@nestjs/common';
import { CheckpointsService } from './checkpoints.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import * as QRCode from 'qrcode';
import type { Response } from 'express';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { UpdateCheckpointDto } from './dto/update-checkpoint.dto';

@Controller('admin/events/:eventId/checkpoints')
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(
    @Param('eventId') eventId: string,
    @Body() createCheckpointDto: CreateCheckpointDto,
  ) {
    return this.checkpointsService.create(+eventId, createCheckpointDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAllByEvent(@Param('eventId') eventId: string) {
    return this.checkpointsService.findAllByEvent(+eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.checkpointsService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateCheckpointDto: UpdateCheckpointDto,
  ) {
    return this.checkpointsService.update(+id, updateCheckpointDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.checkpointsService.remove(+id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id/qr-code')
  async getQrCode(@Param('id') id: string, @Res() res: Response) {
    const checkpoint = await this.checkpointsService.findOne(+id);
    if (!checkpoint) {
      return res.status(404).send('Checkpoint not found');
    }
    const baseUrl = process.env.FRONTEND_URL;
    const deepLinkUrl = `${baseUrl}/team/scan?qr=${checkpoint.qrSecretString}`;
    const qrDataUrl = await QRCode.toDataURL(deepLinkUrl);
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(base64Data, 'base64'));
  }
}
