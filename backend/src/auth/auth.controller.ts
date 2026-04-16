import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '@prisma/client';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() signInDto: LoginDto) {
    const user = await this.authService.validateUser(
      signInDto.username,
      signInDto.password,
    );
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.authService.login(user, signInDto.keepLoggedIn);
  }

  @Throttle({ auth: { ttl: 60000, limit: 20 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    return this.authService.refresh(token);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findByUsername(req.user.username);
    if (!user) throw new UnauthorizedException();
    return { username: user.username, language: user.language };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Put('profile/language')
  async changeLanguage(
    @Request() req: any,
    @Body() body: { language: string },
  ) {
    const user = await this.usersService.findByUsername(req.user.username);
    if (!user) throw new UnauthorizedException();
    await this.usersService.updateAdminLanguage(user.id, body.language);
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Put('profile/password')
  async changePassword(
    @Request() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.usersService.findByUsername(req.user.username);
    if (!user) throw new UnauthorizedException();
    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    await this.usersService.updateTeam(user.id, undefined, body.newPassword);
    return { success: true };
  }
}
