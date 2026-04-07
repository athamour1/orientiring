import { Controller, Post, Get, Body, UseGuards, ConflictException, Param, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/events/:eventId/teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService
  ) {}

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    const existing = await this.usersService.findByUsername(username);
    return { taken: !!existing };
  }

  @Get()
  async getTeams(@Param('eventId') eventId: string) {
    return this.prisma.user.findMany({
      where: { role: Role.TEAM, eventId: +eventId },
      select: { id: true, username: true }
    });
  }

  @Post()
  async createTeam(@Param('eventId') eventId: string, @Body() body: { username: string; password: string }) {
    const existing = await this.usersService.findByUsername(body.username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const user = await this.usersService.createTeam(body.username, body.password, +eventId);
    return { id: user.id, username: user.username };
  }

  @Delete(':id')
  async removeTeam(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
