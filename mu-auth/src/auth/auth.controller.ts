// src/auth/auth.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Authentification utilisateur
   */
  @GrpcMethod('AuthService', 'Login')
  async login(request: { username: string, password: string }) {
    try {
      const result = await this.authService.login(request.username, request.password);
      return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        tokenType: 'Bearer'
      };
    } catch (error) {
      this.logger.error(`Error in Login: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Rafraîchissement de token
   */
  @GrpcMethod('AuthService', 'RefreshToken')
  async refreshToken(request: { refreshToken: string }) {
    try {
      const result = await this.authService.refreshToken(request.refreshToken);
      return {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        tokenType: 'Bearer'
      };
    } catch (error) {
      this.logger.error(`Error in RefreshToken: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Validation de token
   */
  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(request: { token: string }) {
    try {
      const userInfo = await this.authService.validateToken(request.token);
      return {
        valid: true,
        userId: userInfo.userId,
        email: userInfo.email || '',
        givenName: userInfo.givenName || '',
        familyName: userInfo.familyName || '',
        roles: userInfo.roles || []
      };
    } catch (error) {
      this.logger.error(`Error in ValidateToken: ${error instanceof Error ? error.message : String(error)}`);
      return { valid: false };
    }
  }

  /**
   * Obtenir un token administrateur
   */
  @GrpcMethod('AuthService', 'GetAdminToken')
  async getAdminToken() {
    try {
      const token = await this.authService.getAdminToken();
      return { token };
    } catch (error) {
      this.logger.error(`Error in GetAdminToken: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}