export interface RedisConfig {
    host: string;           
    port: number;          
    password?: string;      // Mot de passe 
    db?: number;            // Base de données 
    prefix?: string;        // Préfixe pour les clés 
    tls?: boolean;          // Connexion TLS 
  }
  
  /**
   * Client pour interagir avec Redis
   */
  export interface RedisClient {
  
    get(key: string): Promise<string | null>;
    
    set(key: string, value: string, ttl?: number): Promise<void>;
    
    delete(key: string): Promise<void>;
    
    exists(key: string): Promise<boolean>;
    
    keys(pattern: string): Promise<string[]>;

    
    logAuthorizationDecision(
      userId: string,
      resourceId: string,
      resourceType: string,
      action: string,
      allowed: boolean,
      reason?: string,
      context?: Record<string, any>
    ): Promise<void>;
  
    getAuthorizationHistory(
      userId?: string,
      resourceId?: string,
      limit?: number,
      offset?: number
    ): Promise<Array<Record<string, any>>>;
    
    close(): Promise<void>;
  }