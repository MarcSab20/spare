import { AuthConfig } from './interface/common.js';
import { getEnv } from './utils/env.js';

/**
 * Charge la configuration depuis les variables d'environnement
 */
export function loadConfig(): AuthConfig {
  return {
    keycloak: {
      url: getEnv('KEYCLOAK_URL', 'http://localhost:8080/auth'),
      realm: getEnv('KEYCLOAK_REALM', 'master'),
      clientId: getEnv('KEYCLOAK_CLIENT_ID', 'admin-cli'),
      clientSecret: getEnv('KEYCLOAK_CLIENT_SECRET', 'changeme'),
      timeout: parseInt(getEnv('KEYCLOAK_TIMEOUT', '10000')),
    },
    opa: {
      url: getEnv('OPA_URL', 'http://localhost:8181'),
      policyPath: getEnv('OPA_POLICY_PATH', '/v1/data/authz/allow'),
      timeout: parseInt(getEnv('OPA_TIMEOUT', '5000')),
    },
    redis: {
      host: getEnv('REDIS_HOST', 'localhost'),
      port: parseInt(getEnv('REDIS_PORT', '6379')),
      password: getEnv('REDIS_PASSWORD', ''),
      db: parseInt(getEnv('REDIS_DB', '0')),
      prefix: getEnv('REDIS_PREFIX', 'smp:auth'),
      tls: getEnv('REDIS_TLS', 'false') === 'true',
    },
  };
}

/**
 * Charge la configuration depuis un fichier JSON (avec gestion des erreurs)
 * @param filePath Chemin vers le fichier de configuration
 */
export async function loadConfigFromFile(filePath: string): Promise<AuthConfig> {
  try {
    const fs = await import('fs/promises');
    const configData = await fs.readFile(filePath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Fusion avec la configuration par défaut
    return {
      keycloak: { ...loadConfig().keycloak, ...config.keycloak },
      opa: { ...loadConfig().opa, ...config.opa },
      redis: { ...loadConfig().redis, ...config.redis },
    };
  } catch (error) {
    console.warn(`Erreur lors du chargement du fichier de configuration: ${error instanceof Error ? error.message : String(error)}`);
    console.warn('Utilisation de la configuration par défaut');
    return loadConfig();
  }
}