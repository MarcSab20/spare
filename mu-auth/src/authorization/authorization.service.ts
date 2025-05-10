import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { 
  AuthService,
  KeycloakClient, 
  OPAClient, 
  UserInfo,
  OPAInput,
  OPAResult,
  setEnv
} from 'smp-auth-ts';

/**
 * Service d'autorisation principal
 */
@Injectable()
export class AuthorizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthorizationService.name);
  private authService: AuthService;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Initialisation du service d'autorisation
   */
  async onModuleInit() {
    this.setupEnvironment();
    
    this.authService = new AuthService();
    this.logger.log('AuthorizationService initialized');
  }

  /**
   * Configuration de l'environnement pour smp-auth-ts
   */
  private setupEnvironment() {
    setEnv({
     // KEYCLOAK_URL: this.configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080/auth'),
     // KEYCLOAK_REALM: this.configService.get<string>('KEYCLOAK_REALM', 'master'),
     // KEYCLOAK_CLIENT_ID: this.configService.get<string>('KEYCLOAK_CLIENT_ID', 'admin-cli'),
     // KEYCLOAK_CLIENT_SECRET: this.configService.get<string>('KEYCLOAK_CLIENT_SECRET', 'changeme'),
      OPA_URL: this.configService.get<string>('OPA_URL', 'http://localhost:8181'),
      OPA_POLICY_PATH: this.configService.get<string>('OPA_POLICY_PATH', '/v1/data/authz/decision'),
      REDIS_HOST: this.configService.get<string>('REDIS_HOST', 'localhost'),
      REDIS_PORT: this.configService.get<string>('REDIS_PORT', '6379'),
      REDIS_PASSWORD: this.configService.get<string>('REDIS_PASSWORD', ''),
      REDIS_DB: this.configService.get<string>('REDIS_DB', '0'),
      REDIS_PREFIX: this.configService.get<string>('REDIS_PREFIX', 'mu:auth'),
    });
  }

  /**
   * Nettoyage des ressources lors de l'arrêt
   */
  async onModuleDestroy() {
    await this.authService.close();
    this.logger.log('AuthorizationService destroyed');
  }

  /**
   * Vérifie l'autorisation avec un token JWT
   */
  async checkAccessWithToken(
    token: string, 
    resourceId: string, 
    resourceType: string, 
    action: string,
    resourceAttributes?: Record<string, any>,
    context?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const userInfo = await this.validateToken(token);
      
      const opaInput: OPAInput = {
        user: {
          id: userInfo.sub,
          roles: userInfo.roles,
          attributes: userInfo.attributes || {},
          organization_ids: userInfo.organization_ids
        },
        resource: {
          id: resourceId,
          type: resourceType,
          attributes: resourceAttributes || {},
        },
        action,
        context: context || {}
      };
      
      const result = await this.authService.getOPAClient().checkPermission(opaInput);
      
      await this.logAuthorizationDecision(
        userInfo.sub,
        resourceId,
        resourceType,
        action,
        result.allow,
        result.reason,
        context
      );
      
      return {
        allowed: result.allow,
        reason: result.reason
      };
    } catch (error) {
      this.logger.error(`Error during token-based authorization: ${error instanceof Error ? error.message : String(error)}`);
      return {
        allowed: false,
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Vérifie l'autorisation avec un ID utilisateur
   */
  async checkAccessWithUserId(
    userId: string, 
    resourceId: string, 
    resourceType: string, 
    action: string,
    userAttributes?: Record<string, any>,
    resourceAttributes?: Record<string, any>,
    context?: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      let userInfo: UserInfo;
      try {
        userInfo = await this.getUserInfo(userId);
      } catch (error) {
        this.logger.warn(`Failed to get user info, using mock data for testing: ${error instanceof Error ? error.message : String(error)}`);
      
        // Données simulées pour les tests
        userInfo = {
          sub: userId,
          email: `${userId}@example.com`,
          roles: ['USER', 'VIEWER'],
          attributes: userAttributes || {},
          organization_ids: []
        };
      }
    
      const mergedUserAttributes = {
        ...(userInfo.attributes || {}),
        ...(userAttributes || {})
      };
      
      const opaInput: OPAInput = {
        user: {
          id: userInfo.sub,
          roles: userInfo.roles,
          attributes: mergedUserAttributes,
          organization_ids: userInfo.organization_ids
        },
        resource: {
          id: resourceId,
          type: resourceType,
          attributes: resourceAttributes || {},
        },
        action,
        context: context || {}
      };
      
      const result = await this.authService.getOPAClient().checkPermission(opaInput);
      
      await this.logAuthorizationDecision(
        userId,
        resourceId,
        resourceType,
        action,
        result.allow,
        result.reason,
        context
      );
      
      return {
        allowed: result.allow,
        reason: result.reason
      };
    } catch (error) {
      this.logger.error(`Error during userId-based authorization: ${error instanceof Error ? error.message : String(error)}`);
      return {
        allowed: false,
        reason: `Error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Valide un token JWT et récupère les informations utilisateur
   */
  async validateToken(token: string): Promise<UserInfo> {
    try {
      return this.authService.getKeycloakClient().validateToken(token);
    } catch (error) {
      this.logger.warn(`Token validation failed, using mock data for testing: ${error instanceof Error ? error.message : String(error)}`);
      // Pour les tests sans Keycloak, retourner des données simulées
      return {
        sub: 'test-user',
        email: 'test@example.com',
        roles: ['USER', 'VIEWER'],
        attributes: {},
        organization_ids: []
      };
    }
  }

  /**
   * Récupère les informations d'un utilisateur par ID
   */
  async getUserInfo(userId: string): Promise<UserInfo> {
    try {
      return this.authService.getKeycloakClient().getUserInfo(userId);
    } catch (error) {
      this.logger.warn(`User info retrieval failed, using mock data for testing: ${error instanceof Error ? error.message : String(error)}`);
      // Pour les tests sans Keycloak, retourner des données simulées
      return {
        sub: userId,
        email: `${userId}@example.com`,
        roles: ['USER', 'VIEWER'],
        attributes: {},
        organization_ids: []
      };
    }
  }

  /**
   * Récupère les rôles d'un utilisateur
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      return this.authService.getKeycloakClient().getRoles(userId);
    } catch (error) {
      this.logger.warn(`Role retrieval failed, using mock data for testing: ${error instanceof Error ? error.message : String(error)}`);
      return ['USER', 'VIEWER'];
    }
  }

  /**
   * Invalide le cache pour un utilisateur
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      return this.authService.invalidateUserCache(userId);
    } catch (error) {
      this.logger.warn(`Cache invalidation skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
 * Journalise une décision d'autorisation
 */
private async logAuthorizationDecision(
  userId: string,
  resourceId: string,
  resourceType: string,
  action: string,
  allowed: boolean,
  reason?: string,
  context?: Record<string, any>
): Promise<void> {
  try {
    await this.authService.logAuthorizationDecision(
      userId,
      resourceId,
      resourceType,
      action,
      allowed,
      reason,
      context
    );
    this.logger.debug(`Authorization decision logged to Redis: ${userId}, ${resourceId}, ${action}, ${allowed}`);
  } catch (error) {
    this.logger.error(`Failed to log authorization decision to Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Récupère l'historique des décisions d'autorisation
 */
async getAuthorizationHistory(
  userId?: string,
  resourceId?: string,
  limit: number = 100,
  offset: number = 0
): Promise<Array<Record<string, any>>> {
  try {
    return await this.authService.getAuthorizationHistory(userId, resourceId, limit, offset);
  } catch (error) {
    this.logger.error(`Failed to get authorization history: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

}