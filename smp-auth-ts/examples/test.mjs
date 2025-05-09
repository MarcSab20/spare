
import { AuthService, setEnv } from '../dist/index.js';

// Définir des variables d'environnement simulées pour le test
setEnv({
  KEYCLOAK_URL: 'http://localhost:8080/auth',
  KEYCLOAK_REALM: 'master',
  KEYCLOAK_CLIENT_ID: 'test-client',
  KEYCLOAK_CLIENT_SECRET: 'test-secret',
  OPA_URL: 'http://localhost:8181',
  REDIS_HOST: 'localhost'
});

async function test() {
  console.log('Initialisation du service d\'autorisation...');
  const authService = new AuthService();
  
  try {
    // Test de la connexion OPA
    console.log('Test de la connexion OPA...');
    const opaClient = authService.getOPAClient();
    const healthCheck = await opaClient.healthCheck();
    console.log('OPA Health Check:', healthCheck ? 'OK' : 'Failed');
    
    // Test d'une évaluation avec OPA
    console.log('\nTest d\'évaluation d\'une politique...');
    const testInput = {
      user: {
        id: 'test-user',
        roles: ['VIEWER'],
        attributes: {
          department: 'IT'
        }
      },
      resource: {
        id: 'test-resource',
        type: 'Document',
        attributes: {
          owner: 'test-user',
          department: 'IT'
        }
      },
      action: 'read'
    };
    
    try {
      const result = await opaClient.checkPermission(testInput);
      console.log('Résultat de l\'évaluation:', result);
    } catch (error) {
      console.log('Erreur lors de l\'évaluation OPA (normal si OPA n\'est pas configuré):', error.message);
    }
    
    // Test du client Redis
    console.log('\nTest de la connexion Redis...');
    const redisClient = authService.getRedisClient();
    try {
      await redisClient.set('test-key', 'test-value', 60);
      const value = await redisClient.get('test-key');
      console.log('Redis get/set test:', value === 'test-value' ? 'OK' : 'Failed');
      await redisClient.delete('test-key');
    } catch (error) {
      console.log('Erreur Redis (normal si Redis n\'est pas configuré):', error.message);
    }
    
    console.log('\nTest terminé. Vérifiez les résultats ci-dessus.');
  } catch (error) {
    console.error('Erreur lors du test:', error);
  } finally {
    // Fermer les connexions
    await authService.close();
  }
}

test().catch(console.error);