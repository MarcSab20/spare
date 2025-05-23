/**
 * Interface pour le service d'authentification principal
 */
export interface IAuthenticationService {
  login(username: string, password: string): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
  validateToken(token: string): Promise<TokenValidationResult>;
  validateTokenEnriched(token: string): Promise<EnrichedTokenValidationResult>;
  getClientCredentialsToken(): Promise<AuthResponse>;
  logout(token: string): Promise<void>;
  getUserInfo(userId: string): Promise<UserInfo | null>;
  getUserRoles(userId: string): Promise<string[]>;
  invalidateUserCache(userId: string): Promise<void>;
}

/**
 * Réponse d'authentification standard
 */
export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * Résultat de validation de token basique
 */
export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  roles?: string[];
}

/**
 * Résultat de validation de token enrichi avec informations complètes
 */
export interface EnrichedTokenValidationResult {
  valid: boolean;
  userInfo?: UserInfo;
  userId?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  roles?: string[];
  rawKeycloakData?: Record<string, any>;
}

/**
 * Informations utilisateur complètes compatibles OPA
 */
export interface UserInfo {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  roles: string[];
  organization_ids?: string[];
  state?: string;
  attributes?: UserAttributes;
  resource_access?: Record<string, { roles: string[] }>;
  realm_access?: { roles: string[] };
}

/**
 * Attributs utilisateur étendus pour OPA
 */
export interface UserAttributes {
  // Attributs de base
  department?: string;
  clearanceLevel?: number;
  contractExpiryDate?: string;
  managerId?: string;
  
  // Attributs professionnels
  jobTitle?: string;
  businessUnit?: string;
  territorialJurisdiction?: string;
  technicalExpertise?: string;
  hierarchyLevel?: number;
  workLocation?: string;
  employmentType?: string;
  
  // Attributs de sécurité et vérification
  verificationStatus?: string;
  riskScore?: number;
  certifications?: string[];
  accessHistory?: Record<string, any>;
  
  // Attributs personnels
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
  
  // Attributs Keycloak personnalisés
  [key: string]: any;
}

/**
 * Configuration pour les tests et la surveillance
 */
export interface ConnectionTestResult {
  connected: boolean;
  info?: string;
  error?: string;
  latency?: number;
  details?: Record<string, any>;
}

/**
 * Interface pour le cache utilisateur
 */
export interface UserCacheEntry {
  userInfo: UserInfo;
  roles: string[];
  cachedAt: string;
  expiresAt: string;
}

/**
 * Interface pour les logs d'authentification
 */
export interface AuthenticationLog {
  userId: string;
  action: 'login' | 'logout' | 'token_refresh' | 'token_validation' | 'cache_invalidation';
  success: boolean;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Interface pour la gestion des sessions
 */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActivity: string;
  ip?: string;
  userAgent?: string;
  active: boolean;
}

/**
 * Options de configuration pour l'authentification
 */
export interface AuthenticationOptions {
  enableCache?: boolean;
  cacheExpiry?: number;
  enableLogging?: boolean;
  enableSessionTracking?: boolean;
  maxSessions?: number;
  tokenValidationStrategy?: 'introspection' | 'jwt_decode' | 'userinfo';
}