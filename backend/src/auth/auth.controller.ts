import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@ghoomo/db';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Public()
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Public()
  @Post('google')
  googleLogin(@Body() input: GoogleLoginDto) {
    return this.authService.loginWithGoogle(input);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/users')
  findUsersForAdmin() {
    return this.authService.findUsersForAdmin();
  }
}
