import { createClient, RedisClientType } from 'redis';
import { RedisConfig, RedisClient } from '../interface/redis.interface.js';

export class RedisClientImpl implements RedisClient {
  private readonly config: RedisConfig;
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly keyPrefix: string;
  
  /**
   * Construit un nouveau client Redis
   * @param config Configuration Redis
   */
  constructor(config: RedisConfig) {
    this.config = config;
    this.keyPrefix = config.prefix || '';
    
    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
      },
      password: this.config.password,
      database: this.config.db || 0,
    });
    
    this.client.on('error', (err) => {
      console.error('Erreur Redis:', err);
      this.connected = false;
    });
    
    this.client.on('connect', () => {
      this.connected = true;
    });
  }
  
  /**
   * Assure que le client est connecté avant d'exécuter des opérations
   * @private
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      this.connected = true;
    }
  }
  
  /**
   * Construit une clé complète avec préfixe si configuré
   * @private
   */
  private getFullKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }
  
  /**
   * Récupère une valeur par sa clé
   * @param key Clé à récupérer
   */
  async get(key: string): Promise<string | null> {
    await this.ensureConnected();
    const fullKey = this.getFullKey(key);
    return await this.client.get(fullKey);
  }
  
  /**
   * Stocke une valeur avec une clé et une durée de vie optionnelle
   * @param key Clé pour stocker la valeur
   * @param value Valeur à stocker
   * @param ttl Durée de vie en secondes (optionnel)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.ensureConnected();
    const fullKey = this.getFullKey(key);
    
    if (ttl) {
      await this.client.set(fullKey, value, { EX: ttl });
    } else {
      await this.client.set(fullKey, value);
    }
  }
  
  /**
   * Supprime une clé
   * @param key Clé à supprimer
   */
  async delete(key: string): Promise<void> {
    await this.ensureConnected();
    const fullKey = this.getFullKey(key);
    await this.client.del(fullKey);
  }
  
  /**
   * Vérifie si une clé existe
   * @param key Clé à vérifier
   */
  async exists(key: string): Promise<boolean> {
    await this.ensureConnected();
    const fullKey = this.getFullKey(key);
    const result = await this.client.exists(fullKey);
    return result === 1;
  }
  
  /**
   * Récupère toutes les clés correspondant à un pattern
   * @param pattern Pattern de recherche
   */
  async keys(pattern: string): Promise<string[]> {
    await this.ensureConnected();
    const fullPattern = this.getFullKey(pattern);
    const keys = await this.client.keys(fullPattern);
    
    // Si un préfixe est défini, on le retire des clés retournées
    if (this.keyPrefix) {
      const prefixLength = this.keyPrefix.length + 1; // +1 pour le ':'
      return keys.map(key => key.substring(prefixLength));
    }
    
    return keys;
  }

  /**
 * Journalise une décision d'autorisation dans Redis
 */
  async logAuthorizationDecision(
    userId: string,
    resourceId: string,
    resourceType: string,
    action: string,
    allowed: boolean,
    reason?: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.ensureConnected();
    
    // Créer un ID unique pour la décision
    const decisionId = `decision:${Date.now()}:${Math.random().toString(36).substring(2, 15)}`;
    
    // Créer l'objet de décision 
    const decision = {
      userId,
      resourceId,
      resourceType,
      action,
      allowed: String(allowed), // Convertir en string
      reason: reason || (allowed ? "Autorisation accordée" : "Autorisation refusée"),
      context: JSON.stringify(context || {}), // Convertir l'objet en string JSON
      timestamp: new Date().toISOString()
    };
    
    // Sauvegarder la décision comme une hash
    const key = this.getFullKey(decisionId);
    
    for (const [field, value] of Object.entries(decision)) {
      await this.client.hSet(key, field, value);
    }
    
    // Définir une durée de vie pour l'enregistrement 
    await this.client.expire(key, 30 * 24 * 60 * 60);
    
    // Ajouter à des ensembles pour récupération facile par utilisateur ou ressource
    await this.client.sAdd(this.getFullKey(`user:${userId}:decisions`), decisionId);
    await this.client.sAdd(this.getFullKey(`resource:${resourceId}:decisions`), decisionId);
    
    // Ajouter à une liste temporelle pour les requêtes chronologiques
    await this.client.zAdd(this.getFullKey('decisions:timeline'), {
      score: Date.now(),
      value: decisionId
    });
  }
    /**
   * Récupère l'historique des décisions d'autorisation
   */
  async getAuthorizationHistory(
    userId?: string,
    resourceId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Array<Record<string, any>>> {
    await this.ensureConnected();
    
    let decisionIds: string[] = [];
    
    // Récupérer les décisions 
    if (userId && resourceId) {
      // décisions pour un utilisateur et une ressource simulatnément
      const userDecisions = await this.client.sMembers(this.getFullKey(`user:${userId}:decisions`));
      const resourceDecisions = await this.client.sMembers(this.getFullKey(`resource:${resourceId}:decisions`));
      decisionIds = userDecisions.filter(id => resourceDecisions.includes(id));
    } else if (userId) {
      // Décisions pour un utilisateur 
      decisionIds = await this.client.sMembers(this.getFullKey(`user:${userId}:decisions`));
    } else if (resourceId) {
      // Décisions pour une ressource 
      decisionIds = await this.client.sMembers(this.getFullKey(`resource:${resourceId}:decisions`));
    } else {
      // Tri des décisions suivant le temps
      decisionIds = await this.client.zRange(
        this.getFullKey('decisions:timeline'), 
        offset, 
        offset + limit - 1,
        { REV: true }
      );
    }

    // Limiter les résultats 
    if (!userId && !resourceId) {
      decisionIds = decisionIds.slice(offset, offset + limit);
    }
    
    // Récupérer les détails de chaque décision
    const decisions: Array<Record<string, any>> = [];
  for (const id of decisionIds) {
    const redisDecision = await this.client.hGetAll(this.getFullKey(id));
    if (Object.keys(redisDecision).length > 0) {
      const processedDecision: Record<string, any> = {
        ...redisDecision,
       
        allowed: redisDecision.allowed === 'true'
      };
      
      // Traiter le contexte 
      if (redisDecision.context) {
        try {
          processedDecision.context = JSON.parse(redisDecision.context);
        } catch (e) {
          processedDecision.context = redisDecision.context;
        }
      }
      
      decisions.push(processedDecision);
    }
  }
  
  return decisions;
  }
  
  async close(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
}