
const defaultEnv: Record<string, string> = {
    KEYCLOAK_URL: 'http://localhost:8080/auth',
    KEYCLOAK_REALM: 'master',
    KEYCLOAK_CLIENT_ID: 'admin-cli',
    KEYCLOAK_CLIENT_SECRET: 'changeme',
    KEYCLOAK_TIMEOUT: '10000',
    OPA_URL: 'http://localhost:8181',
    OPA_POLICY_PATH: '/v1/data/authz/allow',
    OPA_TIMEOUT: '5000',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    REDIS_PREFIX: 'smp:auth',
    REDIS_DB: '0',
    REDIS_TLS: 'false'
  };
  
  /**
   * Configuration d'environnement personnalisée
   */
  let customEnv: Record<string, string> = {};
  
  /**
   * Lit une variable d'environnement depuis process.env, customEnv ou defaultEnv
   */
  export function getEnv(key: string, defaultValue?: string): string {
    try {
      // Essayer process.env si disponible
      if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string;
      }
    } catch (e) {

    }
  
    // Essayer customEnv
    if (customEnv[key]) {
      return customEnv[key];
    }
  
    // Essayer defaultEnv
    if (defaultEnv[key]) {
      return defaultEnv[key];
    }
  
    // Utiliser defaultValue ou chaîne vide
    return defaultValue || '';
  }
  
  /**
   * Définit des variables d'environnement personnalisées
   */
  export function setEnv(env: Record<string, string>): void {
    customEnv = { ...customEnv, ...env };
  }
  
  export function resetEnv(): void {
    customEnv = {};
  }