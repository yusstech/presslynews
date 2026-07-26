import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto';

/** Reset links are deliberately short-lived. */
const RESET_TTL_MINUTES = 60;

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        locale: user.locale,
      },
    };
  }

  /**
   * Start a password reset.
   *
   * Always resolves the same way whether or not the address exists — an
   * attacker must not be able to use this endpoint to enumerate staff accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users.findByEmail(dto.email);

    if (user?.active) {
      // Only the hash is stored, so the table is useless to anyone who reads it.
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

      await this.prisma.passwordResetToken.create({
        data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
      });
      await this.notifications.passwordReset(user, token, RESET_TTL_MINUTES);
    }

    return { ok: true };
  }

  /** Complete a reset. The token is single-use and expires. */
  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Any other outstanding link for this user is now void.
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null },
      }),
    ]);

    await this.notifications.passwordChanged(record.user);
    return { ok: true };
  }
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
