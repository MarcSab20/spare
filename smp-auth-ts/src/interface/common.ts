export interface AuthConfig {
    keycloak: import('./keycloak.interface.js').KeycloakConfig;
    opa: import('./opa.interface.js').OPAConfig;
    redis: import('./redis.interface.js').RedisConfig;
  }
  
  /**
   * Résultat d'une vérification d'autorisation
   */
  export interface AuthorizationResult {
    allowed: boolean;      // Décision d'autorisation
    reason?: string;       // Raison de la décision (optionnel)
  }
  
  /**
   * Demande d'autorisation
   */
  export interface AuthorizationRequest {
    userId: string;        // ID de l'utilisateur
    resourceId: string;    // ID de la ressource
    resourceType: string;  // Type de ressource
    action: string;        // Action demandée
    userAttributes?: Record<string, any>;    // Attributs utilisateur (optionnel)
    resourceAttributes?: Record<string, any>; // Attributs ressource (optionnel)
    context?: Record<string, any>;           // Contexte supplémentaire (optionnel)
  }