import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any, keepLoggedIn = false) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    const expiresIn = keepLoggedIn ? '30d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      role: user.role
    };
  }

  async refresh(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const payload = { username: decoded.username, sub: decoded.sub, role: decoded.role };
      return { access_token: this.jwtService.sign(payload), role: decoded.role };
    } catch {
      throw new UnauthorizedException('Token invalid or expired');
    }
  }
}
