import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async createTeam(
    username: string,
    plainTextPassword: string,
    eventId?: number,
  ) {
    const passwordHash = await bcrypt.hash(plainTextPassword, 10);
    return this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: Role.TEAM,
        eventId: eventId || null,
      },
    });
  }

  async createAdmin(username: string, plainTextPassword: string) {
    const passwordHash = await bcrypt.hash(plainTextPassword, 10);
    return this.prisma.user.create({
      data: {
        username,
        passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  async updateAdminLanguage(id: number, language: string) {
    return this.prisma.user.update({ where: { id }, data: { language } });
  }

  async updateTeam(id: number, username?: string, plainTextPassword?: string) {
    const data: any = {};
    if (username) data.username = username;
    if (plainTextPassword)
      data.passwordHash = await bcrypt.hash(plainTextPassword, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true },
    });
  }

  async remove(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }
}
