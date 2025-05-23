import { UserInfo, UserAttributes } from './auth.interface.js';

/**
 * Configuration Keycloak de base
 */
export interface KeycloakConfig {
  url: string; // URL de base Keycloak (ex: http://keycloak:8080)
  realm: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
  adminClientId?: string;
  adminClientSecret?: string;
  enableCache?: boolean;
  cacheExpiry?: number;
}

/**
 * Interface de base Keycloak (compatible avec smp-auth-ts)
 */
export interface KeycloakClient {
  validateToken(token: string): Promise<UserInfo>;
  getRoles(userId: string): Promise<string[]>;
  getUserInfo(userId: string): Promise<UserInfo>;
  getAdminToken(): Promise<string>;
}

/**
 * Interface Keycloak étendue avec méthodes supplémentaires
 */
export interface KeycloakClientExtended extends KeycloakClient {
  validateTokenRaw(token: string): Promise<KeycloakTokenIntrospection>;
  getUserData(userId: string): Promise<KeycloakUserData>;
  refreshAdminToken(): Promise<string>;
  
  // Méthodes de gestion des utilisateurs
  createUser(userData: Partial<KeycloakUserData>): Promise<string>;
  updateUser(userId: string, userData: Partial<KeycloakUserData>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  enableUser(userId: string): Promise<void>;
  disableUser(userId: string): Promise<void>;
  
  // Méthodes de gestion des rôles
  assignRoles(userId: string, roles: string[]): Promise<void>;
  removeRoles(userId: string, roles: string[]): Promise<void>;
  getUserRealmRoles(userId: string): Promise<string[]>;
  getUserClientRoles(userId: string, clientId: string): Promise<string[]>;
  
  // Méthodes de gestion des groupes
  addUserToGroup(userId: string, groupId: string): Promise<void>;
  removeUserFromGroup(userId: string, groupId: string): Promise<void>;
  getUserGroups(userId: string): Promise<string[]>;
  
  // Méthodes de gestion des sessions
  getUserSessions(userId: string): Promise<any[]>;
  logoutUser(userId: string): Promise<void>;
  logoutAllSessions(userId: string): Promise<void>;
  
  // Méthodes utilitaires
  searchUsers(query: string, limit?: number): Promise<KeycloakUserData[]>;
  getUserByUsername(username: string): Promise<KeycloakUserData | null>;
  getUserByEmail(email: string): Promise<KeycloakUserData | null>;
  
  // Test de connectivité
  healthCheck(): Promise<boolean>;
  getServerInfo(): Promise<any>;
}

/**
 * Réponse brute de Keycloak pour l'introspection de token
 */
export interface KeycloakTokenIntrospection {
  active: boolean;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  
  // Attributs personnalisés Keycloak
  organization_ids?: string | string[];
  department?: string | string[];
  clearance_level?: string | number;
  contract_expiry_date?: string;
  manager_id?: string;
  job_title?: string;
  business_unit?: string;
  territorial_jurisdiction?: string;
  technical_expertise?: string;
  hierarchy_level?: string | number;
  work_location?: string;
  verification_status?: string;
  employment_type?: string;
  user_state?: string;
  risk_score?: string | number;
  
  [key: string]: any;
}

/**
 * Données utilisateur complètes de Keycloak Admin API
 */
export interface KeycloakUserData {
  id: string;
  username: string;
  email?: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  attributes?: {
    [key: string]: string[];
  };
  groups?: string[];
  realmRoles?: string[];
  clientRoles?: {
    [clientId: string]: string[];
  };
  federatedIdentities?: Array<{
    identityProvider: string;
    userId: string;
    userName: string;
  }>;
  disableableCredentialTypes?: string[];
  requiredActions?: string[];
  notBefore?: number;
  access?: {
    manageGroupMembership: boolean;
    view: boolean;
    mapRoles: boolean;
    impersonate: boolean;
    manage: boolean;
  };
}

/**
 * Options de requête pour Keycloak
 */
export interface KeycloakQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  exact?: boolean;
  enabled?: boolean;
  briefRepresentation?: boolean;
}

/**
 * Mapper les données Keycloak vers UserInfo
 */
export interface KeycloakUserMapper {
  mapTokenIntrospectionToUserInfo(data: KeycloakTokenIntrospection): UserInfo;
  mapUserDataToUserInfo(data: KeycloakUserData): UserInfo;
  mapAttributesToUserAttributes(attributes: { [key: string]: string[] }): UserAttributes;
  extractOrganizationIds(data: KeycloakTokenIntrospection | KeycloakUserData): string[];
  extractRoles(data: KeycloakTokenIntrospection | KeycloakUserData): string[];
}

/**
 * Configuration des attributs personnalisés Keycloak
 */
export interface KeycloakAttributeConfig {
  organizationIdsAttribute: string;
  departmentAttribute: string;
  clearanceLevelAttribute: string;
  contractExpiryAttribute: string;
  managerIdAttribute: string;
  jobTitleAttribute: string;
  businessUnitAttribute: string;
  workLocationAttribute: string;
  verificationStatusAttribute: string;
  employmentTypeAttribute: string;
  riskScoreAttribute: string;
  
  // Mapping des attributs personnalisés
  customAttributeMapping: {
    [keycloakAttribute: string]: string; // nom d'attribut OPA
  };
}

/**
 * Wrapper pour étendre KeycloakClientImpl de smp-auth-ts
 */
export class ExtendedKeycloakClient implements KeycloakClientExtended {
  constructor(
    private baseClient: KeycloakClient,
    private config: KeycloakConfig
  ) {}

  // Méthodes de base (délégation vers smp-auth-ts)
  async validateToken(token: string): Promise<UserInfo> {
    return this.baseClient.validateToken(token);
  }

  async getRoles(userId: string): Promise<string[]> {
    return this.baseClient.getRoles(userId);
  }

  async getUserInfo(userId: string): Promise<UserInfo> {
    return this.baseClient.getUserInfo(userId);
  }

  async getAdminToken(): Promise<string> {
    return this.baseClient.getAdminToken();
  }

  // Méthodes étendues (implémentation manuelle)
  async validateTokenRaw(token: string): Promise<KeycloakTokenIntrospection> {
    // Implémentation manuelle de l'introspection
    const axios = await import('axios');
    
    const url = `${this.config.url}/realms/${this.config.realm}/protocol/openid-connect/token/introspect`;
    
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', this.config.clientId);
    params.append('client_secret', this.config.clientSecret);
    
    const response = await axios.default.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: this.config.timeout || 5000
    });
    
    return response.data;
  }

  async getUserData(userId: string): Promise<KeycloakUserData> {
    const axios = await import('axios');
    
    const adminToken = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
    
    const response = await axios.default.get(url, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout || 5000
    });
    
    return response.data;
  }

  async refreshAdminToken(): Promise<string> {
    // Implémentation simple qui recharge un nouveau token
    return this.getAdminToken();
  }

  // Méthodes de gestion des utilisateurs (implémentations de base)
  async createUser(userData: Partial<KeycloakUserData>): Promise<string> {
    const axios = await import('axios');
    
    const adminToken = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users`;
    
    const response = await axios.default.post(url, userData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout || 5000
    });
    
    // Extraire l'ID de l'utilisateur créé depuis l'en-tête Location
    const location = response.headers.location;
    return location ? location.split('/').pop() || '' : '';
  }

  async updateUser(userId: string, userData: Partial<KeycloakUserData>): Promise<void> {
    const axios = await import('axios');
    
    const adminToken = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
    
    await axios.default.put(url, userData, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout || 5000
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const axios = await import('axios');
    
    const adminToken = await this.getAdminToken();
    const url = `${this.config.url}/admin/realms/${this.config.realm}/users/${userId}`;
    
    await axios.default.delete(url, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout || 5000
    });
  }

  async enableUser(userId: string): Promise<void> {
    await this.updateUser(userId, { enabled: true });
  }

  async disableUser(userId: string): Promise<void> {
    await this.updateUser(userId, { enabled: false });
  }

  // Stubs pour les autres méthodes (à implémenter selon les besoins)
  async assignRoles(userId: string, roles: string[]): Promise<void> {
    throw new Error('Method not implemented. Please implement assignRoles based on your Keycloak setup.');
  }

  async removeRoles(userId: string, roles: string[]): Promise<void> {
    throw new Error('Method not implemented. Please implement removeRoles based on your Keycloak setup.');
  }

  async getUserRealmRoles(userId: string): Promise<string[]> {
    // Utiliser la méthode de base
    return this.getRoles(userId);
  }

  async getUserClientRoles(userId: string, clientId: string): Promise<string[]> {
    throw new Error('Method not implemented. Please implement getUserClientRoles based on your Keycloak setup.');
  }

  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    throw new Error('Method not implemented. Please implement addUserToGroup based on your Keycloak setup.');
  }

  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    throw new Error('Method not implemented. Please implement removeUserFromGroup based on your Keycloak setup.');
  }

  async getUserGroups(userId: string): Promise<string[]> {
    throw new Error('Method not implemented. Please implement getUserGroups based on your Keycloak setup.');
  }

  async getUserSessions(userId: string): Promise<any[]> {
    throw new Error('Method not implemented. Please implement getUserSessions based on your Keycloak setup.');
  }

  async logoutUser(userId: string): Promise<void> {
    throw new Error('Method not implemented. Please implement logoutUser based on your Keycloak setup.');
  }

  async logoutAllSessions(userId: string): Promise<void> {
    throw new Error('Method not implemented. Please implement logoutAllSessions based on your Keycloak setup.');
  }

  async searchUsers(query: string, limit?: number): Promise<KeycloakUserData[]> {
    throw new Error('Method not implemented. Please implement searchUsers based on your Keycloak setup.');
  }

  async getUserByUsername(username: string): Promise<KeycloakUserData | null> {
    throw new Error('Method not implemented. Please implement getUserByUsername based on your Keycloak setup.');
  }

  async getUserByEmail(email: string): Promise<KeycloakUserData | null> {
    throw new Error('Method not implemented. Please implement getUserByEmail based on your Keycloak setup.');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const axios = await import('axios');
      const url = `${this.config.url}/realms/${this.config.realm}`;
      
      const response = await axios.default.get(url, {
        timeout: this.config.timeout || 5000
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getServerInfo(): Promise<any> {
    const axios = await import('axios');
    const url = `${this.config.url}/admin/serverinfo`;
    
    const adminToken = await this.getAdminToken();
    
    const response = await axios.default.get(url, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout || 5000
    });
    
    return response.data;
  }
}