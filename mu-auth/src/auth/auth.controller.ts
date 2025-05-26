import { Controller, Post, Body, Get, Headers, Logger, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';

// Dans auth.controller.ts
import { EventLoggerService } from './services/event-logger.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService, private readonly eventLogger: EventLoggerService) {}

  /**
   * Authentification utilisateur
   */
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    try {
      const { accessToken, refreshToken } = await this.authService.authenticateUser(body.username, body.password);
      
      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer'
        }
      };
    } catch (error) {
      this.logger.error(`Login failed for user ${body.username}:`, error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Authentication failed',
          error: error.message 
        }, 
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * Rafraîchissement de token
   */
  @Post('refresh')
  async refreshToken(@Body() body: { refresh_token: string }) {
    try {
      const { accessToken, refreshToken } = await this.authService.refreshUserToken(body.refresh_token);
      
      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer'
        }
      };
    } catch (error) {
      this.logger.error('Token refresh failed:', error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Token refresh failed',
          error: error.message 
        }, 
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * Déconnexion utilisateur
   */
  @Post('logout')
  async logout(@Headers('authorization') authHeader: string) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new HttpException('Token required', HttpStatus.BAD_REQUEST);
      }

      const token = authHeader.substring(7);
      await this.authService.logoutUser(token);
      
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      this.logger.error('Logout failed:', error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Logout failed',
          error: error.message 
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validation de token
   */
  @Post('validate')
  async validateToken(@Body() body: { token: string }) {
    try {
      const result = await this.authService.validateToken(body.token);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Token validation failed:', error.message);
      return {
        success: false,
        data: { valid: false },
        error: error.message
      };
    }
  }

  /**
   * Validation enrichie de token
   */
  @Post('validate-enriched')
  async validateTokenEnriched(@Body() body: { token: string }) {
    try {
      const result = await this.authService.validateTokenEnriched(body.token);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Enriched token validation failed:', error.message);
      return {
        success: false,
        data: { valid: false },
        error: error.message
      };
    }
  }

  /**
   * Informations utilisateur
   */
  @Get('user/:userId')
  async getUserInfo(@Body() body: { userId: string }) {
    try {
      const userInfo = await this.authService.getUserInfo(body.userId);
      
      if (!userInfo) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      
      return {
        success: true,
        data: userInfo
      };
    } catch (error) {
      this.logger.error(`Failed to get user info for ${body.userId}:`, error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Failed to get user info',
          error: error.message 
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Rôles utilisateur
   */
  @Get('user/:userId/roles')
  async getUserRoles(@Body() body: { userId: string }) {
    try {
      const roles = await this.authService.getUserRoles(body.userId);
      
      return {
        success: true,
        data: { roles }
      };
    } catch (error) {
      this.logger.error(`Failed to get user roles for ${body.userId}:`, error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Failed to get user roles',
          error: error.message 
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Token administrateur
   */
  @Post('admin-token')
  async getAdminToken() {
    try {
      const token = await this.authService.getAdminToken();
      
      return {
        success: true,
        data: {
          accessToken: token,
          tokenType: 'Bearer'
        }
      };
    } catch (error) {
      this.logger.error('Failed to get admin token:', error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Failed to get admin token',
          error: error.message 
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Invalidation du cache utilisateur
   */
  @Post('invalidate-cache')
  async invalidateUserCache(@Body() body: { userId: string }) {
    try {
      await this.authService.invalidateUserCache(body.userId);
      
      return {
        success: true,
        message: 'User cache invalidated successfully'
      };
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for user ${body.userId}:`, error.message);
      throw new HttpException(
        { 
          success: false, 
          message: 'Failed to invalidate user cache',
          error: error.message 
        }, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test de connexion Redis
   */
  @Get('test/redis')
  async testRedisConnection() {
    try {
      const result = await this.authService.testRedisConnection();
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Redis connection test failed:', error.message);
      return {
        success: false,
        data: { connected: false },
        error: error.message
      };
    }
  }

  /**
   * Test de connexion Keycloak
   */
  @Get('test/keycloak')
  async testKeycloakConnection() {
    try {
      const result = await this.authService.testKeycloakConnection();
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      this.logger.error('Keycloak connection test failed:', error.message);
      return {
        success: false,
        data: { connected: false },
        error: error.message
      };
    }
  }

  /**
   * Health check général
   */
  @Get('health')
  async healthCheck() {
    try {
      const [redisTest, keycloakTest] = await Promise.all([
        this.authService.testRedisConnection(),
        this.authService.testKeycloakConnection()
      ]);

      const allHealthy = redisTest.connected && keycloakTest.connected;

      return {
        success: true,
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          redis: {
            status: redisTest.connected ? 'up' : 'down',
            latency: redisTest.latency,
            error: redisTest.error
          },
          keycloak: {
            status: keycloakTest.connected ? 'up' : 'down',
            latency: keycloakTest.latency,
            error: keycloakTest.error
          }
        }
      };
    } catch (error) {
      this.logger.error('Health check failed:', error.message);
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Événements récents
   */
  @Get('events/recent')
  async getRecentEvents(@Query('limit') limit?: string) {
    try {
      const events = await this.eventLogger.getRecentEvents(
        limit ? parseInt(limit) : 50
      );
      
      return {
        success: true,
        data: events,
        count: events.length
      };
    } catch (error) {
      throw new HttpException({
        success: false,
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Événements par type
   */
  @Get('events/type/:type')
  async getEventsByType(
    @Param('type') type: string,
    @Query('limit') limit?: string
  ) {
    try {
      const events = await this.eventLogger.getEventsByType(
        type,
        limit ? parseInt(limit) : 50
      );
      
      return {
        success: true,
        data: events,
        count: events.length
      };
    } catch (error) {
      throw new HttpException({
        success: false,
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Événements par utilisateur
   */
  @Get('events/user/:userId')
  async getEventsByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    try {
      const events = await this.eventLogger.getEventsByUser(
        userId,
        limit ? parseInt(limit) : 50
      );
      
      return {
        success: true,
        data: events,
        count: events.length
      };
    } catch (error) {
      throw new HttpException({
        success: false,
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Statistiques quotidiennes
   */
  @Get('events/stats')
  async getStats(@Query('date') date?: string) {
    try {
      const stats = await this.eventLogger.getStats(date);
      
      return {
        success: true,
        date: date || new Date().toISOString().split('T')[0],
        data: stats
      };
    } catch (error) {
      throw new HttpException({
        success: false,
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}