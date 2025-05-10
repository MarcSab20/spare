import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeycloakClientImpl } from 'smp-auth-ts';
import axios from 'axios';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private keycloakClient: KeycloakClientImpl;

  constructor(
    private readonly configService: ConfigService
  ) {}

  /**
   * Initialisation du service d'authentification
   */
  async onModuleInit() {
    const keycloakConfig = {
      url: this.configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080'),
      realm: this.configService.get<string>('KEYCLOAK_REALM', 'mu-realm'),
      clientId: this.configService.get<string>('KEYCLOAK_CLIENT_ID', 'mu-client'),
      clientSecret: this.configService.get<string>('KEYCLOAK_CLIENT_SECRET', ''),
      timeout: parseInt(this.configService.get<string>('KEYCLOAK_TIMEOUT', '5000')),
    };
    
    this.keycloakClient = new KeycloakClientImpl(keycloakConfig);
    this.logger.log('AuthService initialized');
  }

  /**
   * Nettoyage lors de l'arrêt du module
   */
  async onModuleDestroy() {
    this.logger.log('AuthService destroyed');
  }

  /**
   * Login utilisateur avec mot de passe
   */
  async login(username: string, password: string): Promise<{access_token: string, refresh_token: string}> {
    try {
      const keycloakUrl = this.configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
      const realm = this.configService.get<string>('KEYCLOAK_REALM') || 'mu-realm';
      const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'mu-client';
      const clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || '';
      
      // URL pour Keycloak récent (sans /auth)
      const url = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
      
      // Utiliser URLSearchParams au lieu de JSON
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('username', username);
      params.append('password', password);
      params.append('scope', 'openid email profile');
      
      console.log('URL:', url);
      console.log('Params:', params.toString());
      
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token
      };
    } catch (error) {
      console.error('Login failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Rafraîchir un token
   */
  async refreshToken(refreshToken: string): Promise<{access_token: string, refresh_token: string}> {
    try {
      const keycloakUrl = this.configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
      const realm = this.configService.get<string>('KEYCLOAK_REALM') || 'mu-realm';
      const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'mu-client';
      const clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || '';
      
      const url = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
      
      // Utiliser URLSearchParams pour x-www-form-urlencoded
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('refresh_token', refreshToken);
      
      console.log('URL de rafraîchissement:', url);
      console.log('Params:', params.toString());
      console.log('Refresh token (premiers caractères):', refreshToken.substring(0, 10) + '...');
      
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token
      };
    } catch (error) {
      console.error('Rafraîchissement de token échoué:', error.response?.data || error.message);
      console.error('Détails de l\'erreur:', error.response?.data?.error_description || error.response?.statusText);
      throw error;
    }
  }

  /**
   * Valider un token
   */
  async validateToken(token: string) {
    try {
      const keycloakUrl = this.configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8080';
      const realm = this.configService.get<string>('KEYCLOAK_REALM') || 'mu-realm';
      const clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'mu-client';
      const clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || '';
      
      // Utiliser l'introspection
      const url = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token/introspect`;
      
      const params = new URLSearchParams();
      params.append('token', token);
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      if (!response.data.active) {
        return { valid: false };
      }
      
      // Extraire les informations de la réponse
      return {
        valid: true,
        userId: response.data.sub || token.sub,
        email: response.data.email || '',
        givenName: response.data.given_name || response.data.name || '',
        familyName: response.data.family_name || '',
        roles: this.extractRoles(response.data)
      };
    } catch (error) {
      console.error('Validation de token échouée:', error.message);
      return { valid: false };
    }
  }
  
  private extractRoles(data: any): string[] {
    const roles: string[] = [];
    
    if (data.realm_access && Array.isArray(data.realm_access.roles)) {
      roles.push(...data.realm_access.roles);
    }
    
    if (data.resource_access) {
      Object.values(data.resource_access).forEach((resource: any) => {
        if (resource.roles && Array.isArray(resource.roles)) {
          roles.push(...resource.roles);
        }
      });
    }
    
    return [...new Set(roles)]; // Éliminer les doublons
  }

  /**
   * Obtenir un token admin (client_credentials)
   */
  async getAdminToken() {
    return this.keycloakClient.getAdminToken();
  }

  /**
   * Obtenir les informations d'un utilisateur
   */
  async getUserInfo(userId: string) {
    return this.keycloakClient.getUserInfo(userId);
  }

  /**
   * Obtenir les rôles d'un utilisateur
   */
  async getUserRoles(userId: string) {
    return this.keycloakClient.getRoles(userId);
  }

  /**
   * Authentifie un utilisateur avec nom d'utilisateur et mot de passe
   */
  async authenticateUser(username: string, password: string): Promise<{accessToken: string, refreshToken: string}> {
    try {
      // Implémentation avec body JSON
      const url = `${this.configService.get('KEYCLOAK_URL')}/realms/${this.configService.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;
      
      const body = {
        grant_type: 'password',
        client_id: this.configService.get('KEYCLOAK_CLIENT_ID'),
        client_secret: this.configService.get('KEYCLOAK_CLIENT_SECRET'),
        username,
        password
      };
      
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token
      };
    } catch (error) {
      this.logger.error(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Rafraîchit un token d'utilisateur
   */
  async refreshUserToken(refreshToken: string): Promise<{accessToken: string, refreshToken: string}> {
    try {
      const url = `${this.configService.get('KEYCLOAK_URL')}/realms/${this.configService.get('KEYCLOAK_REALM')}/protocol/openid-connect/token`;
      
      const body = {
        grant_type: 'refresh_token',
        client_id: this.configService.get('KEYCLOAK_CLIENT_ID'),
        client_secret: this.configService.get('KEYCLOAK_CLIENT_SECRET'),
        refresh_token: refreshToken
      };
      
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token
      };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Déconnecte un utilisateur
   */
  async logoutUser(token: string): Promise<void> {
    try {
      const url = `${this.configService.get('KEYCLOAK_URL')}/realms/${this.configService.get('KEYCLOAK_REALM')}/protocol/openid-connect/logout`;
      
      const body = {
        client_id: this.configService.get('KEYCLOAK_CLIENT_ID'),
        client_secret: this.configService.get('KEYCLOAK_CLIENT_SECRET'),
        token
      };
      
      await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      this.logger.error(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}