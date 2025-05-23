import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { OPAInput, OPAResult, OPAClient, OPAConfig } from 'smp-auth-ts';
import { OPAClientImpl } from 'smp-auth-ts';
import { createClient, RedisClientType } from 'redis';

/**
 * Interface pour les informations utilisateur
 */
export interface UserInfo {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  roles: string[];
  attributes?: Record<string, any>;
  organization_ids?: string[];
}

/**
 * Configuration Redis
 */
interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  prefix: string;
}

/**
 * Entrée de journal d'autorisation
 */
interface AuthorizationLog {
  userId: string;
  resourceId: string;
  resourceType: string;
  action: string;
  allow: boolean;
  reason?: string;
  context?: Record<string, any>;
  timestamp: string;
}

/**
 * Service d'autorisation principal
 */
@Injectable()
export class AuthorizationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthorizationService.name);
  private opaClient: OPAClient;
  private redisClient: RedisClientType;
  private readonly redisConfig: RedisConfig;
  private readonly userCacheExpiry: number = 3600; // 1 heure par défaut

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    // Initialisation de la configuration Redis
    this.redisConfig = {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.configService.get<string>('REDIS_PORT', '6379')),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: parseInt(this.configService.get<string>('REDIS_DB', '0')),
      prefix: this.configService.get<string>('REDIS_PREFIX', 'auth:'),
    };
  }

  /**
   * Initialisation du service d'autorisation
   */
  async onModuleInit() {
    // Initialiser le client OPA
    const opaConfig: OPAConfig = {
      url: this.configService.get<string>('OPA_URL', 'http://localhost:8181'),
      policyPath: this.configService.get<string>('OPA_POLICY_PATH', '/v1/data/authz/decision'),
      timeout: parseInt(this.configService.get<string>('OPA_TIMEOUT', '5000')),
    };
    
    this.opaClient = new OPAClientImpl(opaConfig);
    
    // Initialiser le client Redis
    this.redisClient = createClient({
      url: `redis://${this.redisConfig.password ? `:${this.redisConfig.password}@` : ''}${this.redisConfig.host}:${this.redisConfig.port}/${this.redisConfig.db}`,
    }) as RedisClientType;

    this.redisClient.on('error', (err) => {
      this.logger.error(`Redis client error: ${err}`);
    });

    try {
      await this.redisClient.connect();
      this.logger.log('Redis client connected successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    this.logger.log('AuthorizationService initialized');
  }

  /**
   * Nettoyage des ressources lors de l'arrêt
   */
  async onModuleDestroy() {
    // Fermer la connexion Redis
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected');
    }
    
    this.logger.log('AuthorizationService destroyed');
  }

  /**
   * Méthode principale pour vérifier l'accès directement avec l'entrée OPA
   */
  async checkAccess(input: OPAInput): Promise<OPAResult> {
    try {
      const result = await this.opaClient.checkPermission(input);
      
      // Journaliser la décision
      await this.logAuthorizationDecision(
        input.user.id,
        input.resource.id,
        input.resource.type,
        input.action,
        result.allow,
        result.reason,
        input.context
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Error during authorization check: ${error instanceof Error ? error.message : String(error)}`);
      return { 
        allow: false, 
        reason: `Error: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Vérifier l'accès avec un token JWT
   */
  async checkAccessWithToken(token: string, input: OPAInput): Promise<OPAResult> {
    try {
      // Valider le token et récupérer les informations utilisateur
      const userInfo = await this.validateToken(token);
      
      // Enrichir l'entrée OPA avec les informations utilisateur du token
      const enrichedInput: OPAInput = {
        ...input,
        user: {
          ...input.user,
          id: userInfo.sub || input.user.id,
          roles: userInfo.roles || input.user.roles,
          organization_ids: userInfo.organization_ids || input.user.organization_ids,
          attributes: {
            ...(userInfo.attributes || {}),
            ...(input.user.attributes || {})
          }
        }
      };
      
      // Utiliser la méthode principale pour vérifier l'accès
      return this.checkAccess(enrichedInput);
    } catch (error) {
      this.logger.error(`Error during token-based authorization: ${error instanceof Error ? error.message : String(error)}`);
      return { 
        allow: false, 
        reason: `Error: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
  
  /**
   * Vérifier l'accès avec un ID utilisateur
   */
  async checkAccessWithUserId(
    userId: string, 
    resourceId: string, 
    resourceType: string, 
    action: string,
    userAttributes?: Record<string, any>,
    resourceAttributes?: Record<string, any>,
    context?: Record<string, any>
  ): Promise<OPAResult> {
    try {
      let userInfo: UserInfo;
      
      // Essayer de récupérer les informations utilisateur depuis le cache
      const cacheKey = `${this.redisConfig.prefix}user:${userId}`;
      const cachedUserInfo = await this.redisClient.get(cacheKey);
      
      if (cachedUserInfo) {
        userInfo = JSON.parse(cachedUserInfo);
        this.logger.debug(`User info retrieved from cache for user ${userId}`);
      } else {
        try {
          // Récupérer les informations utilisateur
          userInfo = await this.getUserInfo(userId);
          
          // Mettre en cache les informations utilisateur
          await this.redisClient.set(
            cacheKey, 
            JSON.stringify(userInfo), 
            { EX: this.userCacheExpiry }
          );
          
          this.logger.debug(`User info cached for user ${userId}`);
        } catch (error) {
          this.logger.warn(`Failed to get user info, using mock data for testing: ${error instanceof Error ? error.message : String(error)}`);
          
          // Données simulées pour les tests
          userInfo = {
            sub: userId,
            email: `${userId}@example.com`,
            roles: ['USER', 'VIEWER'],
            attributes: {},
            organization_ids: []
          };
        }
      }
      
      // Fusionner les attributs utilisateur
      const mergedUserAttributes = {
        ...(userInfo.attributes || {}),
        ...(userAttributes || {})
      };
      
      // Créer l'entrée OPA
      const opaInput: OPAInput = {
        user: {
          id: userInfo.sub,
          roles: userInfo.roles,
          organization_ids: userInfo.organization_ids,
          attributes: mergedUserAttributes
        },
        resource: {
          id: resourceId,
          type: resourceType,
          attributes: resourceAttributes || {},
        },
        action,
        context: context || {}
      };
      
      // Vérifier l'accès
      return this.checkAccess(opaInput);
    } catch (error) {
      this.logger.error(`Error during userId-based authorization: ${error instanceof Error ? error.message : String(error)}`);
      return { 
        allow: false, 
        reason: `Error: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Valider un token JWT et récupérer les informations utilisateur
   */
  async validateToken(token: string): Promise<UserInfo> {
    try {
      // Essayer de récupérer les informations utilisateur depuis le cache
      const tokenHash = this.hashToken(token);
      const cacheKey = `${this.redisConfig.prefix}token:${tokenHash}`;
      const cachedUserInfo = await this.redisClient.get(cacheKey);
      
      if (cachedUserInfo) {
        return JSON.parse(cachedUserInfo);
      }
      
      // À adapter selon le système d'authentification utilisé (Keycloak, Auth0, etc.)
      // Pour les tests, retourner des données simulées
      const userInfo: UserInfo = {
        sub: 'test-user',
        email: 'test@example.com',
        roles: ['USER', 'VIEWER'],
        attributes: {},
        organization_ids: []
      };
      
      // Mettre en cache les informations utilisateur
      await this.redisClient.set(
        cacheKey, 
        JSON.stringify(userInfo), 
        { EX: this.userCacheExpiry }
      );
      
      return userInfo;
    } catch (error) {
      throw new Error(`Token validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupérer les informations d'un utilisateur par ID
   */
  async getUserInfo(userId: string): Promise<UserInfo> {
    try {
      // À adapter selon le système d'authentification utilisé (Keycloak, Auth0, etc.)
      // Pour les tests, retourner des données simulées
      return {
        sub: userId,
        email: `${userId}@example.com`,
        roles: ['USER', 'VIEWER'],
        attributes: {},
        organization_ids: []
      };
    } catch (error) {
      throw new Error(`Failed to get user info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupérer les rôles d'un utilisateur
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      // Essayer de récupérer les rôles depuis le cache
      const cacheKey = `${this.redisConfig.prefix}roles:${userId}`;
      const cachedRoles = await this.redisClient.get(cacheKey);
      
      if (cachedRoles) {
        return JSON.parse(cachedRoles);
      }
      
      // À adapter selon le système d'authentification utilisé
      // Pour les tests, retourner des données simulées
      const roles = ['USER', 'VIEWER'];
      
      // Mettre en cache les rôles
      await this.redisClient.set(
        cacheKey, 
        JSON.stringify(roles), 
        { EX: this.userCacheExpiry }
      );
      
      return roles;
    } catch (error) {
      throw new Error(`Failed to get user roles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Invalider le cache pour un utilisateur
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const userCacheKey = `${this.redisConfig.prefix}user:${userId}`;
      const rolesCacheKey = `${this.redisConfig.prefix}roles:${userId}`;
      
      // Supprimer les entrées de cache
      await this.redisClient.del(userCacheKey);
      await this.redisClient.del(rolesCacheKey);
      
      this.logger.debug(`Cache invalidated for user ${userId}`);
    } catch (error) {
      throw new Error(`Failed to invalidate user cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Journaliser une décision d'autorisation
   */
  private async logAuthorizationDecision(
    userId: string,
    resourceId: string,
    resourceType: string,
    action: string,
    allow: boolean,
    reason?: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      // Créer l'entrée de journal
      const logEntry: AuthorizationLog = {
        userId,
        resourceId,
        resourceType,
        action,
        allow,
        reason,
        context,
        timestamp: new Date().toISOString()
      };
      
      // Clé pour l'historique utilisateur
      const userLogKey = `${this.redisConfig.prefix}logs:user:${userId}`;
      
      // Clé pour l'historique ressource
      const resourceLogKey = `${this.redisConfig.prefix}logs:resource:${resourceId}`;
      
      // Clé pour l'historique global
      const globalLogKey = `${this.redisConfig.prefix}logs:global`;
      
      // Enregistrer l'entrée de journal dans Redis (liste)
      const serializedEntry = JSON.stringify(logEntry);
      
      // Utiliser un pipeline Redis pour améliorer les performances
      const pipeline = this.redisClient.multi();
      
      // Ajouter l'entrée aux différentes listes
      pipeline.lPush(userLogKey, serializedEntry);
      pipeline.lPush(resourceLogKey, serializedEntry);
      pipeline.lPush(globalLogKey, serializedEntry);
      
      // Limiter la taille des listes (conserver les 1000 dernières entrées)
      pipeline.lTrim(userLogKey, 0, 999);
      pipeline.lTrim(resourceLogKey, 0, 999);
      pipeline.lTrim(globalLogKey, 0, 9999);
      
      // Exécuter le pipeline
      await pipeline.exec();
      
      this.logger.debug(`Authorization decision logged: ${userId}, ${resourceId}, ${action}, ${allow}`);
    } catch (error) {
      this.logger.error(`Failed to log authorization decision: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupérer l'historique des décisions d'autorisation
   */
  async getAuthorizationHistory(
    userId?: string,
    resourceId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuthorizationLog[]> {
    try {
      let key: string;
      
      if (userId) {
        key = `${this.redisConfig.prefix}logs:user:${userId}`;
      } else if (resourceId) {
        key = `${this.redisConfig.prefix}logs:resource:${resourceId}`;
      } else {
        key = `${this.redisConfig.prefix}logs:global`;
      }
      
      // Vérifier si la clé existe
      const exists = await this.redisClient.exists(key);
      
      if (!exists) {
        return [];
      }
      
      // Récupérer les entrées de journal
      const logs = await this.redisClient.lRange(key, offset, offset + limit - 1);
      
      // Désérialiser les entrées
      return logs.map((log) => JSON.parse(log));
    } catch (error) {
      this.logger.error(`Failed to get authorization history: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Méthodes pour la gestion des politiques OPA
   */
  async updatePolicy(policyId: string, policyContent: string): Promise<void> {
    return this.opaClient.updatePolicy(policyId, policyContent);
  }

  async getPolicy(policyId: string): Promise<string> {
    return this.opaClient.getPolicy(policyId);
  }

  /**
   * Utilitaire pour hacher un token (pour le caching)
   */
  private hashToken(token: string): string {
    // Implémenter une fonction de hachage simple
    // Note: Dans un environnement de production, utiliser une fonction
    // de hachage cryptographique comme SHA-256
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en entier 32 bits
    }
    return hash.toString(16);
  }
}