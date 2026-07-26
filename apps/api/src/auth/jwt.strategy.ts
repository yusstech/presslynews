import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../common/decorators';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.active) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
