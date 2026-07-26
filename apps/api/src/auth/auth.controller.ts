import { Body, Controller, Get, Post, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Always 200, whether or not the address is registered. */
  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
