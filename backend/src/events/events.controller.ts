import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Roles(Role.ADMIN)
  @Get('dashboard-stats')
  getDashboardStats() {
    return this.eventsService.getDashboardStats();
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(+id);
  }

  @Roles(Role.ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(+id, updateEventDto);
  }

  @Roles(Role.ADMIN)
  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.eventsService.getStats(+id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/team-locations')
  getTeamLocations(@Param('id') id: string) {
    return this.eventsService.getTeamLocations(+id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/logs')
  getLogs(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventsService.getLogs(
      +id,
      page ? +page : 1,
      limit ? +limit : 50,
    );
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(+id);
  }

  @Roles(Role.ADMIN)
  @Get(':id/teams/:teamId/route')
  getTeamRoute(@Param('teamId') teamId: string) {
    return this.eventsService.getTeamRoute(+teamId);
  }
}
