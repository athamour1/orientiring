import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  ConflictException,
  BadRequestException,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@SkipThrottle()
@Controller('admin/events/:eventId/teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    const start = Date.now();
    const existing = await this.usersService.findByUsername(username);
    // Constant-time response: ensure at least 200ms to prevent timing-based enumeration
    const elapsed = Date.now() - start;
    if (elapsed < 200) {
      await new Promise((r) => setTimeout(r, 200 - elapsed));
    }
    return { taken: !!existing };
  }

  @Get()
  async getTeams(@Param('eventId') eventId: string) {
    return this.prisma.user.findMany({
      where: { role: Role.TEAM, eventId: +eventId },
      select: { id: true, username: true },
    });
  }

  @Post()
  async createTeam(
    @Param('eventId') eventId: string,
    @Body() body: { username: string; password: string },
  ) {
    const existing = await this.usersService.findByUsername(body.username);
    if (existing) {
      throw new ConflictException('Username already taken');
    }
    const user = await this.usersService.createTeam(
      body.username,
      body.password,
      +eventId,
    );
    return { id: user.id, username: user.username };
  }

  @Post('import')
  async importTeams(
    @Param('eventId') eventId: string,
    @Body() body: { teams: { username: string; password: string }[] },
  ) {
    if (!body.teams || body.teams.length === 0) {
      throw new BadRequestException('No teams provided');
    }
    if (body.teams.length > 100) {
      throw new BadRequestException('Maximum 100 teams per import');
    }
    const results: { username: string; success: boolean; error?: string }[] =
      [];
    for (const team of body.teams) {
      if (!team.username || !team.password) {
        results.push({
          username: team.username || '',
          success: false,
          error: 'Missing username or password',
        });
        continue;
      }
      try {
        const existing = await this.usersService.findByUsername(team.username);
        if (existing) {
          results.push({
            username: team.username,
            success: false,
            error: 'Username already taken',
          });
          continue;
        }
        await this.usersService.createTeam(
          team.username,
          team.password,
          +eventId,
        );
        results.push({ username: team.username, success: true });
      } catch {
        results.push({
          username: team.username,
          success: false,
          error: 'Creation failed',
        });
      }
    }
    return results;
  }

  @Put(':id')
  async updateTeam(
    @Param('id') id: string,
    @Body() body: { username?: string; password?: string },
  ) {
    if (body.username) {
      const existing = await this.usersService.findByUsername(body.username);
      if (existing && existing.id !== +id)
        throw new ConflictException('Username already taken');
    }
    return this.usersService.updateTeam(+id, body.username, body.password);
  }

  @Delete(':id')
  async removeTeam(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
