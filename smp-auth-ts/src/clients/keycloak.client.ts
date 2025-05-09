import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import jwt from 'jsonwebtoken';
import { KeycloakConfig, KeycloakClient, UserInfo } from '../interface/keycloak.interface.js';


export class KeycloakClientImpl implements KeycloakClient {
  private readonly config: KeycloakConfig;
  private readonly axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Construit un nouveau client Keycloak
   * @param config Configuration Keycloak
   */
  constructor(config: KeycloakConfig) {
    this.config = config;
    
    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.config.url,
      timeout: this.config.timeout || 10000,
    };
    
    this.axiosInstance = axios.create(axiosConfig);
  }

  /**
   * Récupère un token d'accès pour les opérations administratives
   * (mise en cache du token jusqu'à son expiration)
   */
  async getAdminToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.config.clientId);
      params.append('client_secret', this.config.clientSecret);

      const response = await this.axiosInstance.post(
        `/realms/${this.config.realm}/protocol/openid-connect/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      return this.accessToken!;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération du token admin: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Valide un token JWT et récupère les informations de l'utilisateur
   * @param token Token JWT à valider
   */
  async validateToken(token: string): Promise<UserInfo> {
    try {
      // Décodage basique du token (sans vérification de signature)
      const decoded = jwt.decode(token);
      
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Token invalide');
      }
      
    
      try {
        const response = await this.axiosInstance.get(
          `/realms/${this.config.realm}/protocol/openid-connect/userinfo`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        // Extraire les rôles du token et/ou de la réponse userinfo
        const roles = this.extractRoles(decoded, response.data);
        
        // Construire l'objet UserInfo
        return {
          sub: response.data.sub,
          email: response.data.email,
          given_name: response.data.given_name,
          family_name: response.data.family_name,
          roles,
          attributes: response.data,
          resource_access: decoded.resource_access,
          organization_ids: this.extractOrganizationIds(response.data),
        };
      } catch (error) {
        throw new Error('Token invalide ou expiré');
      }
    } catch (error) {
      throw new Error(`Erreur de validation du token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupère les rôles d'un utilisateur par son ID
   * @param userId ID de l'utilisateur
   */
  async getRoles(userId: string): Promise<string[]> {
    try {
      const token = await this.getAdminToken();
      
      const realmRolesResponse = await this.axiosInstance.get(
        `/admin/realms/${this.config.realm}/users/${userId}/role-mappings/realm`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const clientRolesResponse = await this.axiosInstance.get(
        `/admin/realms/${this.config.realm}/users/${userId}/role-mappings/clients`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Extraire les rôles realm et client
      const realmRoles = realmRolesResponse.data.map((role: any) => role.name);
      
      // Extraire les rôles client (avec préfixe pour les différencier)
      let clientRoles: string[] = [];
      Object.entries(clientRolesResponse.data || {}).forEach(([clientId, roles]: [string, any]) => {
        roles.forEach((role: any) => {
          clientRoles.push(`${clientId}:${role.name}`);
        });
      });
      
      return [...realmRoles, ...clientRoles];
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des rôles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Récupère les informations complètes d'un utilisateur par son ID
   * @param userId ID de l'utilisateur
   */
  async getUserInfo(userId: string): Promise<UserInfo> {
    try {
      const token = await this.getAdminToken();
      
      const userResponse = await this.axiosInstance.get(
        `/admin/realms/${this.config.realm}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const roles = await this.getRoles(userId);
      
      return {
        sub: userResponse.data.id,
        email: userResponse.data.email,
        given_name: userResponse.data.firstName,
        family_name: userResponse.data.lastName,
        roles,
        attributes: userResponse.data.attributes || {},
        organization_ids: this.extractOrganizationIds(userResponse.data),
      };
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des informations utilisateur: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extrait les rôles des données du token et des informations utilisateur
   * @private
   */
  private extractRoles(decodedToken: any, userInfo: any): string[] {
    const roles: string[] = [];
    
    // Rôles du realm depuis le token
    if (decodedToken.realm_access?.roles) {
      roles.push(...decodedToken.realm_access.roles);
    }
    
    // Rôles des ressources/clients depuis le token
    if (decodedToken.resource_access) {
      Object.entries(decodedToken.resource_access).forEach(([clientId, client]: [string, any]) => {
        if (client.roles) {
          client.roles.forEach((role: string) => {
            roles.push(`${clientId}:${role}`);
          });
        }
      });
    }
    
    // Rôles depuis userInfo (si disponibles)
    if (userInfo.roles) {
      roles.push(...userInfo.roles);
    }
    
    // Éliminer les doublons
    return Array.from(new Set(roles));
  }

  /**
   * Extrait les IDs des organisations depuis les attributs utilisateur
   * @private
   */
  private extractOrganizationIds(userData: any): string[] {
    if (!userData.attributes) {
      return [];
    }
    
    // Si l'attribut organization_ids existe
    if (userData.attributes.organization_ids) {
      return Array.isArray(userData.attributes.organization_ids) 
        ? userData.attributes.organization_ids 
        : [userData.attributes.organization_ids];
    }
    
    // Alternative: si les orgs sont stockées sous un autre format
    if (userData.attributes.organizations) {
      let orgs = userData.attributes.organizations;
      if (!Array.isArray(orgs)) {
        orgs = [orgs];
      }
      
      try {
        // Si format JSON stocké en string
        if (typeof orgs[0] === 'string') {
          return orgs.map((org: string) => {
            try {
              const parsed = JSON.parse(org);
              return parsed.id || parsed.organizationId;
            } catch {
              return org; // Si pas JSON, utiliser comme ID directement
            }
          }).filter(Boolean);
        }
        
        return orgs.map((org: any) => org.id || org.organizationId).filter(Boolean);
      } catch {
        return [];
      }
    }
    
    return [];
  }
}