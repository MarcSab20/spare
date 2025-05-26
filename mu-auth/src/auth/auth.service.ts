import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import axios from 'axios';
import { 
  IAuthenticationService, 
  AuthResponse, 
  TokenValidationResult, 
  EnrichedTokenValidationResult,
  UserInfo,
  UserAttributes,
  ConnectionTestResult,
  UserCacheEntry,
  AuthenticationLog,
  SessionInfo,
  AuthenticationOptions
} from '../../../smp-auth-ts/src/interface/auth.interface';
import { 
  KeycloakConfig, 
  KeycloakClient,
  KeycloakClientExtended,
  KeycloakTokenIntrospection, 
  KeycloakUserData,
  KeycloakAttributeConfig,
  ExtendedKeycloakClient
} from '../../../smp-auth-ts/src/interface/keycloak.interface';

// Import de la librairie smp-auth-ts
import { KeycloakClientImpl } from 'smp-auth-ts';

import { PostgresUserService } from './services/postgres-user.service';
import { KeycloakPostgresSyncService } from './services/keycloak-postgres-sync.service';

import { EventLoggerService } from './services/event-logger.service';

@Injectable()
export class AuthService implements IAuthenticationService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private redisClient: RedisClientType;
  private readonly keycloakConfig: KeycloakConfig;
  private readonly authOptions: AuthenticationOptions;
  private readonly attributeConfig: KeycloakAttributeConfig;
  private eventLogger: EventLoggerService;
  
  // Utiliser l'interface de base compatible avec smp-auth-ts
  private keycloakClient: KeycloakClient;
  private extendedKeycloakClient: KeycloakClientExtended;
  
  private adminTokenCache: {
    token: string;
    expiresAt: number;
  } | null = null;

  constructor(private readonly configService: ConfigService, private readonly postgresUserService: PostgresUserService, eventLogger: EventLoggerService) {
    // Configuration Keycloak
    this.keycloakConfig = {
      url: this.configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080'),
      realm: this.configService.get<string>('KEYCLOAK_REALM', 'mu-realm'),
      clientId: this.configService.get<string>('KEYCLOAK_CLIENT_ID', 'mu-client'),
      clientSecret: this.configService.get<string>('KEYCLOAK_CLIENT_SECRET', ''),
      timeout: parseInt(this.configService.get<string>('KEYCLOAK_TIMEOUT', '5000')),
      adminClientId: this.configService.get<string>('KEYCLOAK_ADMIN_CLIENT_ID'),
      adminClientSecret: this.configService.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET'),
      enableCache: this.configService.get<boolean>('ENABLE_KEYCLOAK_CACHE', true),
      cacheExpiry: parseInt(this.configService.get<string>('KEYCLOAK_CACHE_EXPIRY', '3600'))
    };

    // Options d'authentification
    this.authOptions = {
      enableCache: this.configService.get<boolean>('ENABLE_AUTH_CACHE', true),
      cacheExpiry: parseInt(this.configService.get<string>('AUTH_CACHE_EXPIRY', '3600')),
      enableLogging: this.configService.get<boolean>('ENABLE_AUTH_LOGGING', true),
      enableSessionTracking: this.configService.get<boolean>('ENABLE_SESSION_TRACKING', true),
      maxSessions: parseInt(this.configService.get<string>('MAX_USER_SESSIONS', '5')),
      tokenValidationStrategy: this.configService.get<'introspection' | 'jwt_decode' | 'userinfo'>('TOKEN_VALIDATION_STRATEGY', 'introspection')
    };

    // Configuration des attributs personnalisés
    this.attributeConfig = {
      organizationIdsAttribute: 'organization_ids',
      departmentAttribute: 'department',
      clearanceLevelAttribute: 'clearance_level',
      contractExpiryAttribute: 'contract_expiry_date',
      managerIdAttribute: 'manager_id',
      jobTitleAttribute: 'job_title',
      businessUnitAttribute: 'business_unit',
      workLocationAttribute: 'work_location',
      verificationStatusAttribute: 'verification_status',
      employmentTypeAttribute: 'employment_type',
      riskScoreAttribute: 'risk_score',
      customAttributeMapping: {
        'territorial_jurisdiction': 'territorialJurisdiction',
        'technical_expertise': 'technicalExpertise',
        'hierarchy_level': 'hierarchyLevel',
        'verification_status': 'verificationStatus',
        'employment_type': 'employmentType',
        'work_location': 'workLocation',
        'business_unit': 'businessUnit',
        'job_title': 'jobTitle',
        'manager_id': 'managerId',
        'contract_expiry_date': 'contractExpiryDate',
        'clearance_level': 'clearanceLevel',
        'risk_score': 'riskScore'
      }
    };

    this.eventLogger = eventLogger;
  }

  async onModuleInit() {
    // Initialiser le client Keycloak de base avec smp-auth-ts
    this.keycloakClient = new KeycloakClientImpl(this.keycloakConfig);
    
    // Créer le client étendu
    this.extendedKeycloakClient = new ExtendedKeycloakClient(
      this.keycloakClient,
      this.keycloakConfig
    );

    // Initialiser Redis si le cache est activé
    if (this.authOptions.enableCache) {
      await this.initializeRedis();
    }
    
    

    // Passer le client Redis au logger d'événements
    if (this.redisClient && this.authOptions.enableLogging) {
      this.eventLogger.setRedisClient(this.redisClient);
      this.logger.log('AuthService initialized with smp-auth-ts compatibility');
      this.logger.log('Event logging initialized');
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.isOpen) {
      await this.redisClient.quit();
      this.logger.log('Redis client disconnected');
    }
    this.logger.log('AuthService destroyed');
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: `redis://${this.configService.get('REDIS_PASSWORD') ? `:${this.configService.get('REDIS_PASSWORD')}@` : ''}${this.configService.get('REDIS_HOST', 'localhost')}:${this.configService.get('REDIS_PORT', '6379')}/${this.configService.get('REDIS_DB', '0')}`,
      }) as RedisClientType;

      this.redisClient.on('error', (err) => {
        this.logger.error(`Redis client error: ${err}`);
      });

      await this.redisClient.connect();
      this.logger.log('Redis client connected successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`);
      this.authOptions.enableCache = false;
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const startTime = Date.now();

    try {
      const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', this.keycloakConfig.clientId);
      params.append('client_secret', this.keycloakConfig.clientSecret);
      params.append('username', username);
      params.append('password', password);
      params.append('scope', 'openid email profile');
      
      const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.keycloakConfig.timeout
      });
      
      const authResponse: AuthResponse = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type || 'Bearer',
        expires_in: response.data.expires_in || 3600
      };

      // Journaliser et mettre en cache si activé
      if (this.authOptions.enableLogging) {
        await this.logAuthenticationEvent(username, 'login', true);
      }

      if (this.authOptions.enableCache && response.data.access_token) {
        await this.cacheUserInfoFromToken(response.data.access_token);
      }
      // Log success
      await this.eventLogger.logEvent({
        type: 'login',
        username,
        success: true,
        duration: Date.now() - startTime,
        details: { tokenType: authResponse.token_type }
      });

      return authResponse;
    } catch (error) {
      if (this.authOptions.enableLogging) {
        await this.logAuthenticationEvent(username, 'login', false, error.message);
      }
      // Log failure
      await this.eventLogger.logEvent({
        type: 'login',
        username,
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });

      this.logger.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', this.keycloakConfig.clientId);
      params.append('client_secret', this.keycloakConfig.clientSecret);
      params.append('refresh_token', refreshToken);
      
      const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.keycloakConfig.timeout
      });
      
      const authResponse: AuthResponse = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_type: response.data.token_type || 'Bearer',
        expires_in: response.data.expires_in || 3600
      };

      // Mettre à jour le cache
      if (this.authOptions.enableCache && response.data.access_token) {
        await this.cacheUserInfoFromToken(response.data.access_token);
      }

      return authResponse;
    } catch (error) {
      this.logger.error('Token refresh failed:', error.response?.data || error.message);
      throw error;
    }
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    const startTime = Date.now();
    try {
      // Vérifier le cache en premier si activé
      if (this.authOptions.enableCache) {
        const cached = await this.getCachedTokenValidation(token);
        if (cached) {
          return cached;
        }
      }

      // Utiliser le client Keycloak de smp-auth-ts
      const userInfo = await this.keycloakClient.validateToken(token);
      
      const result: TokenValidationResult = {
        valid: true,
        userId: userInfo.sub,
        email: userInfo.email || '',
        givenName: userInfo.given_name || '',
        familyName: userInfo.family_name || '',
        roles: userInfo.roles || []
      };

      // Mettre en cache si activé
      if (this.authOptions.enableCache) {
        await this.cacheTokenValidation(token, result);
      }

      // Log success
      await this.eventLogger.logEvent({
        type: 'token_validation',
        userId: result.userId,
        success: result.valid,
        duration: Date.now() - startTime,
        details: { 
          cached: false, // Indiquer si c'était en cache
          roles: result.roles?.length || 0
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Token validation failed:', error.message);

      await this.eventLogger.logEvent({
        type: 'token_validation',
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });
      
      return { valid: false };
    }
  }

  async validateTokenEnriched(token: string): Promise<EnrichedTokenValidationResult> {
    try {
      // Vérifier le cache enrichi
      if (this.authOptions.enableCache) {
        const cached = await this.getCachedEnrichedValidation(token);
        if (cached) {
          return cached;
        }
      }

      // Validation de base
      const baseValidation = await this.validateToken(token);
      if (!baseValidation.valid) {
        return { valid: false };
      }

      // Enrichir avec les informations complètes en utilisant le client étendu
      const userInfo = await this.getUserInfoFromTokenUsingExtended(token);
      
      const enrichedResult: EnrichedTokenValidationResult = {
        valid: true,
        userInfo,
        userId: baseValidation.userId,
        email: baseValidation.email,
        givenName: baseValidation.givenName,
        familyName: baseValidation.familyName,
        roles: baseValidation.roles
      };

      // Mettre en cache
      if (this.authOptions.enableCache) {
        await this.cacheEnrichedValidation(token, enrichedResult);
      }

      return enrichedResult;
    } catch (error) {
      this.logger.error('Enriched token validation failed:', error.message);
      return { valid: false };
    }
  }

  async getClientCredentialsToken(): Promise<AuthResponse> {
    try {
      const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/token`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.keycloakConfig.adminClientId || this.keycloakConfig.clientId);
      params.append('client_secret', this.keycloakConfig.adminClientSecret || this.keycloakConfig.clientSecret);
      
      const response = await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.keycloakConfig.timeout
      });
      
      return {
        access_token: response.data.access_token,
        token_type: response.data.token_type || 'Bearer',
        expires_in: response.data.expires_in || 3600
      };
    } catch (error) {
      this.logger.error('Client credentials token failed:', error.message);
      throw error;
    }
  }

  async logout(token: string): Promise<void> {
    try {
      const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/logout`;
      
      const params = new URLSearchParams();
      params.append('client_id', this.keycloakConfig.clientId);
      params.append('client_secret', this.keycloakConfig.clientSecret);
      params.append('token', token);
      
      await axios.post(url, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.keycloakConfig.timeout
      });

      // Invalider le cache
      if (this.authOptions.enableCache) {
        await this.invalidateTokenCache(token);
      }

      // Journaliser
      if (this.authOptions.enableLogging) {
        try {
          const userInfo = await this.keycloakClient.validateToken(token);
          await this.logAuthenticationEvent(userInfo.sub, 'logout', true);
        } catch {
          // Token déjà invalide, ignorer l'erreur de logging
        }
      }
    } catch (error) {
      this.logger.error('Logout failed:', error.message);
      throw error;
    }
  }

  // async getUserInfo(userId: string): Promise<UserInfo | null> {
  //   try {
  //     // Vérifier le cache
  //     if (this.authOptions.enableCache) {
  //       const cached = await this.getCachedUserInfo(userId);
  //       if (cached) {
  //         return cached;
  //       }
  //     }

  //     // Utiliser le client Keycloak de smp-auth-ts
  //     const userInfo = await this.keycloakClient.getUserInfo(userId);

  //     // Mettre en cache
  //     if (this.authOptions.enableCache) {
  //       await this.cacheUserInfo(userId, userInfo);
  //     }

  //     return userInfo;
  //   } catch (error) {
  //     this.logger.error(`Failed to get user info: ${error.message}`);
  //     return null;
  //   }
  // }

  async getUserInfo(userId: string): Promise<UserInfo | null> {
    try {
      // Vérifier d'abord le cache
      if (this.authOptions.enableCache) {
        const cached = await this.getCachedUserInfo(userId);
        if (cached) {
          return cached;
        }
      }

      // Récupérer depuis PostgreSQL d'abord
      const postgresUser = await this.postgresUserService.getUserById(userId);
      
      if (postgresUser) {
        const userInfo = this.mapPostgresUserToUserInfo(postgresUser);
        
        // Mettre en cache
        if (this.authOptions.enableCache) {
          await this.cacheUserInfo(userId, userInfo);
        }
        
        return userInfo;
      }

      // Fallback vers Keycloak si pas trouvé dans PostgreSQL
      const userInfo = await this.keycloakClient.getUserInfo(userId);

      // Synchroniser vers PostgreSQL
      if (userInfo) {
        await this.syncKeycloakUserToPostgres(userInfo);
      }

      // Mettre en cache
      if (this.authOptions.enableCache) {
        await this.cacheUserInfo(userId, userInfo);
      }

      return userInfo;
    } catch (error) {
      this.logger.error(`Failed to get user info: ${error.message}`);
      return null;
    }
  }

  // Nouvelle méthode de mapping
  private mapPostgresUserToUserInfo(pgUser: any): UserInfo {
    return {
      sub: pgUser.id,
      email: pgUser.email,
      given_name: pgUser.first_name,
      family_name: pgUser.last_name,
      preferred_username: pgUser.username,
      roles: Array.isArray(pgUser.roles) ? pgUser.roles : [],
      organization_ids: Array.isArray(pgUser.organization_ids) ? pgUser.organization_ids : [],
      state: pgUser.state,
      attributes: {
        department: pgUser.department,
        clearanceLevel: pgUser.clearance_level,
        contractExpiryDate: pgUser.contract_expiry_date?.toISOString(),
        managerId: pgUser.manager_id,
        jobTitle: pgUser.job_title,
        businessUnit: pgUser.business_unit,
        territorialJurisdiction: pgUser.territorial_jurisdiction,
        technicalExpertise: pgUser.technical_expertise,
        hierarchyLevel: pgUser.hierarchy_level,
        workLocation: pgUser.work_location,
        employmentType: pgUser.employment_type,
        verificationStatus: pgUser.verification_status,
        riskScore: pgUser.risk_score,
        certifications: pgUser.certifications,
        firstName: pgUser.first_name,
        lastName: pgUser.last_name,
        phoneNumber: pgUser.phone_number,
        nationality: pgUser.nationality,
        dateOfBirth: pgUser.date_of_birth?.toISOString(),
        gender: pgUser.gender,
        ...pgUser.custom_attributes
      },
      resource_access: {},
      realm_access: { roles: Array.isArray(pgUser.roles) ? pgUser.roles : [] }
    };
  }

  // Nouvelle méthode de synchronisation
  private async syncKeycloakUserToPostgres(userInfo: UserInfo): Promise<void> {
    try {
      const userData = {
        username: userInfo.preferred_username,
        email: userInfo.email,
        first_name: userInfo.given_name,
        last_name: userInfo.family_name,
        enabled: userInfo.state === 'ACTIVE',
        department: userInfo.attributes?.department,
        clearance_level: userInfo.attributes?.clearanceLevel,
        job_title: userInfo.attributes?.jobTitle,
        business_unit: userInfo.attributes?.businessUnit,
        territorial_jurisdiction: userInfo.attributes?.territorialJurisdiction,
        hierarchy_level: userInfo.attributes?.hierarchyLevel,
        work_location: userInfo.attributes?.workLocation,
        employment_type: userInfo.attributes?.employmentType,
        verification_status: userInfo.attributes?.verificationStatus,
        risk_score: userInfo.attributes?.riskScore,
        phone_number: userInfo.attributes?.phoneNumber,
        nationality: userInfo.attributes?.nationality,
        gender: userInfo.attributes?.gender,
        state: userInfo.state
      };

      await this.postgresUserService.createUser(userData);
    } catch (error) {
      this.logger.error(`Erreur lors de la synchronisation vers PostgreSQL: ${error.message}`);
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    try {
      // Vérifier le cache
      if (this.authOptions.enableCache) {
        const cached = await this.getCachedUserRoles(userId);
        if (cached) {
          return cached;
        }
      }

      // Utiliser le client Keycloak de smp-auth-ts
      const roles = await this.keycloakClient.getRoles(userId);

      // Mettre en cache
      if (this.authOptions.enableCache) {
        await this.cacheUserRoles(userId, roles);
      }

      return roles;
    } catch (error) {
      this.logger.error(`Failed to get user roles: ${error.message}`);
      return [];
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) {
      return;
    }

    try {
      const keys = [
        `auth:user:info:${userId}`,
        `auth:user:roles:${userId}`,
        `auth:user:cache:${userId}`
      ];
      
      await this.redisClient.del(keys);
      this.logger.debug(`Cache invalidated for user ${userId}`);

      if (this.authOptions.enableLogging) {
        await this.logAuthenticationEvent(userId, 'cache_invalidation', true);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate user cache: ${error.message}`);
    }
  }

  // === MÉTHODES PRIVÉES ===

  private async getUserInfoFromTokenUsingExtended(token: string): Promise<UserInfo> {
    // Utiliser l'API userinfo de Keycloak pour obtenir les informations complètes
    const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/userinfo`;
    
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: this.keycloakConfig.timeout
    });
    
    return this.mapTokenDataToUserInfo(response.data);
  }

  private mapTokenDataToUserInfo(data: any): UserInfo {
    const roles = this.extractRolesFromData(data);
    
    return {
      sub: data.sub,
      email: data.email,
      given_name: data.given_name,
      family_name: data.family_name,
      preferred_username: data.preferred_username,
      roles,
      organization_ids: this.extractOrganizationIds(data),
      state: data.user_state || 'ACTIVE',
      attributes: this.mapDataToUserAttributes(data),
      resource_access: data.resource_access,
      realm_access: data.realm_access
    };
  }

  private mapDataToUserAttributes(data: any): UserAttributes {
    const attributes: UserAttributes = {};
    
    // Mapper les attributs selon la configuration
    Object.entries(this.attributeConfig.customAttributeMapping).forEach(([keycloakAttr, opaAttr]) => {
      if (data[keycloakAttr] !== undefined) {
        let value = data[keycloakAttr];
        
        // Conversion des types
        if (keycloakAttr.includes('level') || keycloakAttr.includes('score')) {
          value = typeof value === 'string' ? parseInt(value) : value;
        }
        
        if (Array.isArray(value) && value.length === 1) {
          value = value[0];
        }
        
        attributes[opaAttr] = value;
      }
    });

    // Attributs additionnels
    if (data.email) attributes.email = data.email;
    if (data.given_name) attributes.firstName = data.given_name;
    if (data.family_name) attributes.lastName = data.family_name;

    return attributes;
  }

  private extractRolesFromData(data: any): string[] {
    const roles: string[] = [];
    
    if (data.realm_access?.roles) {
      roles.push(...data.realm_access.roles);
    }
    
    if (data.resource_access) {
      Object.values(data.resource_access).forEach((resource: any) => {
        if (resource.roles) {
          roles.push(...resource.roles);
        }
      });
    }
    
    return [...new Set(roles)];
  }

  private extractOrganizationIds(data: any): string[] {
    const orgIds = data[this.attributeConfig.organizationIdsAttribute];
    
    if (!orgIds) return [];
    
    if (Array.isArray(orgIds)) return orgIds;
    if (typeof orgIds === 'string') return orgIds.split(',').map(id => id.trim());
    
    return [];
  }

  // === MÉTHODES DE CACHE ===

  private async getCachedTokenValidation(token: string): Promise<TokenValidationResult | null> {
    if (!this.authOptions.enableCache || !this.redisClient) return null;
    
    try {
      const tokenHash = this.hashToken(token);
      const cached = await this.redisClient.get(`auth:token:basic:${tokenHash}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached token validation: ${error.message}`);
      return null;
    }
  }

  private async cacheTokenValidation(token: string, result: TokenValidationResult): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) return;
    
    try {
      const tokenHash = this.hashToken(token);
      await this.redisClient.set(
        `auth:token:basic:${tokenHash}`,
        JSON.stringify(result),
        { EX: this.authOptions.cacheExpiry! }
      );
    } catch (error) {
      this.logger.error(`Failed to cache token validation: ${error.message}`);
    }
  }

  private async getCachedEnrichedValidation(token: string): Promise<EnrichedTokenValidationResult | null> {
    if (!this.authOptions.enableCache || !this.redisClient) return null;
    
    try {
      const tokenHash = this.hashToken(token);
      const cached = await this.redisClient.get(`auth:token:enriched:${tokenHash}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached enriched validation: ${error.message}`);
      return null;
    }
  }

  private async cacheEnrichedValidation(token: string, result: EnrichedTokenValidationResult): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) return;
    
    try {
      const tokenHash = this.hashToken(token);
      await this.redisClient.set(
        `auth:token:enriched:${tokenHash}`,
        JSON.stringify(result),
        { EX: this.authOptions.cacheExpiry! }
      );
    } catch (error) {
      this.logger.error(`Failed to cache enriched validation: ${error.message}`);
    }
  }

  private async getCachedUserInfo(userId: string): Promise<UserInfo | null> {
    if (!this.authOptions.enableCache || !this.redisClient) return null;
    
    try {
      const cached = await this.redisClient.get(`auth:user:info:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached user info: ${error.message}`);
      return null;
    }
  }

  private async cacheUserInfo(userId: string, userInfo: UserInfo): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) return;
    
    try {
      await this.redisClient.set(
        `auth:user:info:${userId}`,
        JSON.stringify(userInfo),
        { EX: this.authOptions.cacheExpiry! }
      );
    } catch (error) {
      this.logger.error(`Failed to cache user info: ${error.message}`);
    }
  }

  private async getCachedUserRoles(userId: string): Promise<string[] | null> {
    if (!this.authOptions.enableCache || !this.redisClient) return null;
    
    try {
      const cached = await this.redisClient.get(`auth:user:roles:${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Failed to get cached user roles: ${error.message}`);
      return null;
    }
  }

  private async cacheUserRoles(userId: string, roles: string[]): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) return;
    
    try {
      await this.redisClient.set(
        `auth:user:roles:${userId}`,
        JSON.stringify(roles),
        { EX: this.authOptions.cacheExpiry! }
      );
    } catch (error) {
      this.logger.error(`Failed to cache user roles: ${error.message}`);
    }
  }

  private async cacheUserInfoFromToken(token: string): Promise<void> {
    try {
      const userInfo = await this.getUserInfoFromTokenUsingExtended(token);
      await this.cacheUserInfo(userInfo.sub, userInfo);
    } catch (error) {
      this.logger.error(`Failed to cache user info from token: ${error.message}`);
    }
  }

  private async invalidateTokenCache(token: string): Promise<void> {
    if (!this.authOptions.enableCache || !this.redisClient) return;
    
    try {
      const tokenHash = this.hashToken(token);
      await this.redisClient.del([
        `auth:token:basic:${tokenHash}`,
        `auth:token:enriched:${tokenHash}`
      ]);
    } catch (error) {
      this.logger.error(`Failed to invalidate token cache: ${error.message}`);
    }
  }

  // === MÉTHODES DE LOGGING ===

  private async logAuthenticationEvent(
    userId: string, 
    action: AuthenticationLog['action'], 
    success: boolean, 
    error?: string
  ): Promise<void> {
    if (!this.authOptions.enableLogging || !this.redisClient) return;
    
    try {
      const logEntry: AuthenticationLog = {
        userId,
        action,
        success,
        timestamp: new Date().toISOString(),
        error
      };
      
      await this.redisClient.lPush(
        'auth:logs:authentication',
        JSON.stringify(logEntry)
      );
      
      // Limiter la taille des logs
      await this.redisClient.lTrim('auth:logs:authentication', 0, 9999);
    } catch (error) {
      this.logger.error(`Failed to log authentication event: ${error.message}`);
    }
  }

  // === MÉTHODES UTILITAIRES ===

  private hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // === MÉTHODES DE TEST ===

  async testRedisConnection(): Promise<ConnectionTestResult> {
    if (!this.redisClient) {
      return { connected: false, error: 'Redis client not initialized' };
    }

    try {
      const start = Date.now();
      const pong = await this.redisClient.ping();
      const latency = Date.now() - start;
      
      return { 
        connected: true, 
        info: `Redis connection successful. Response: ${pong}`,
        latency,
        details: { pong }
      };
    } catch (error) {
      return { 
        connected: false, 
        error: `Redis connection failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  async testKeycloakConnection(): Promise<ConnectionTestResult> {
    try {
      const start = Date.now();
      const url = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}`;
      
      const response = await axios.get(url, {
        timeout: this.keycloakConfig.timeout
      });
      
      const latency = Date.now() - start;
      
      return {
        connected: true,
        info: 'Keycloak connection successful',
        latency,
        details: { 
          realm: response.data.realm,
          public_key: response.data.public_key ? 'present' : 'absent'
        }
      };
    } catch (error) {
      return {
        connected: false,
        error: `Keycloak connection failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // === MÉTHODES DE COMPATIBILITÉ AVEC L'ANCIEN CONTRÔLEUR ===

  /**
   * Authentifie un utilisateur (alias pour login)
   */
  async authenticateUser(username: string, password: string): Promise<{accessToken: string, refreshToken: string}> {
    const result = await this.login(username, password);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token || ''
    };
  }

  /**
   * Rafraîchit un token utilisateur (alias pour refreshToken)
   */
  async refreshUserToken(refreshToken: string): Promise<{accessToken: string, refreshToken: string}> {
    const result = await this.refreshToken(refreshToken);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token || ''
    };
  }

  /**
   * Déconnecte un utilisateur (alias pour logout)
   */
  async logoutUser(token: string): Promise<void> {
    return this.logout(token);
  }

  /**
   * Obtient un token admin
   */
  async getAdminToken(): Promise<string> {
    const tokenResponse = await this.getClientCredentialsToken();
    return tokenResponse.access_token;
  }

  // Accès aux clients pour compatibilité
  getKeycloakClient(): KeycloakClient {
    return this.keycloakClient;
  }

  getExtendedKeycloakClient(): KeycloakClientExtended {
    return this.extendedKeycloakClient;
  }
}