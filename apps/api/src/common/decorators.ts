import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@pressly/types';

/** Marks a route as public (skips the global JWT guard). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given roles. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

/** Injects the authenticated user (populated by JwtStrategy). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
