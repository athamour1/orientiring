import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      this.logger.log({ msg: 'Login successful', username, role: user.role });
      return result;
    }
    this.logger.warn({ msg: 'Login failed', username });
    return null;
  }

  async login(user: any, keepLoggedIn = false) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    const expiresIn = keepLoggedIn ? '30d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      role: user.role,
    };
  }

  async refresh(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      const payload = {
        username: decoded.username,
        sub: decoded.sub,
        role: decoded.role,
      };
      // Preserve the original expiry duration so keepLoggedIn tokens stay long-lived
      const originalDuration = decoded.exp - decoded.iat;
      const expiresIn = originalDuration > 24 * 60 * 60 ? '30d' : '8h';
      return {
        access_token: this.jwtService.sign(payload, { expiresIn }),
        role: decoded.role,
      };
    } catch {
      this.logger.warn({ msg: 'Token refresh failed' });
      throw new UnauthorizedException('Token invalid or expired');
    }
  }
}
