import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { UserRole } from '@pressly/types';
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthUser } from './decorators';

/** Global JWT guard — every route requires auth unless marked @Public(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

/** Enforces @Roles(...) on a route. SUPER_ADMIN always passes. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');
    if (user.role === 'SUPER_ADMIN') return true;
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
