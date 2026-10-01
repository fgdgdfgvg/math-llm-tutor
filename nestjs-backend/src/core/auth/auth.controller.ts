import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './guards/global-auth.guard';
import { UnauthorizedAppError } from '../../common/errors/app-error';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用 refresh token 换一对新令牌。
   * 必须 @Public：access token 正是在这里过期的，若要求鉴权就永远换不到新令牌。
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: '刷新访问令牌', description: '用 refresh token 换取新的 access/refresh 令牌对' })
  @ApiResponse({ status: 200, description: '刷新成功，返回新的令牌对' })
  @ApiResponse({ status: 401, description: 'refresh token 无效或已被吊销，需重新登录' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * 登出：服务端吊销 refresh token（令牌族），不只是前端清缓存。
   * 设为 @Public 是因为 access token 可能已过期——过期时用户同样需要能登出。
   */
  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '登出', description: '吊销当前 refresh token，服务端会话立即失效' })
  @ApiResponse({ status: 200, description: '已登出' })
  async logout(@Body() dto: LogoutDto) {
    const revoked = await this.authService.logout(dto?.refreshToken);
    return { success: true, revoked };
  }

  /** 登出所有设备：改密码、疑似失陷后的应急入口 */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '登出所有设备', description: '吊销该用户全部 refresh token' })
  @ApiResponse({ status: 200, description: '已吊销全部会话' })
  @ApiResponse({ status: 401, description: '未授权' })
  async logoutAll(@Request() req: any) {
    const userId = req?.user?.userId ?? req?.user?.sub;
    if (!userId) throw new UnauthorizedAppError('无法识别当前用户');
    const count = await this.authService.logoutAll(String(userId));
    return { success: true, revokedSessions: count };
  }
}
