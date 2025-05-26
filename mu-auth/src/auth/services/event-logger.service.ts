import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType } from 'redis';

export interface AuthEvent {
  id: string;
  type: 'login' | 'logout' | 'token_validation' | 'token_refresh' | 'sync' | 'user_creation' | 'role_assignment' | 'error';
  userId?: string;
  username?: string;
  success: boolean;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
  error?: string;
  duration?: number;
}

// Interface pour les événements en entrée
export interface AuthEventInput {
    type: AuthEvent['type'];
    userId?: string;
    username?: string;
    success?: boolean;
    ip?: string;
    userAgent?: string;
    details?: Record<string, any>;
    error?: string;
    duration?: number;
  }

@Injectable()
export class EventLoggerService {
  private readonly logger = new Logger(EventLoggerService.name);
  private redisClient: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  setRedisClient(client: RedisClientType) {
    this.redisClient = client;
  }

  async logEvent(eventInput: Partial<AuthEventInput>): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn('Redis client not available for event logging');
      return;
    }

    try {
        const fullEvent: AuthEvent = {
          id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          success: eventInput.success ?? true,
          type: eventInput.type as AuthEvent['type'],             
          userId: eventInput.userId,
          username: eventInput.username,
          ip: eventInput.ip,
          userAgent: eventInput.userAgent,
          details: eventInput.details,
          error: eventInput.error,
          duration: eventInput.duration
        };
  

      // Stocker l'événement avec TTL (7 jours par défaut)
      const eventKey = `auth:events:${fullEvent.id}`;
      const ttl = this.configService.get('EVENT_LOG_TTL', 604800); // 7 jours

      await this.redisClient.setEx(
        eventKey,
        ttl,
        JSON.stringify(fullEvent)
      );

      // Ajouter à la liste des événements récents
      await this.redisClient.lPush('auth:events:recent', fullEvent.id);
      await this.redisClient.lTrim('auth:events:recent', 0, 999); // Garder 1000 événements récents

      // Ajouter à la liste par type
      await this.redisClient.lPush(`auth:events:by_type:${fullEvent.type}`, fullEvent.id);
      await this.redisClient.lTrim(`auth:events:by_type:${fullEvent.type}`, 0, 499); // 500 par type

      // Ajouter à la liste par utilisateur si applicable
      if (fullEvent.userId) {
        await this.redisClient.lPush(`auth:events:by_user:${fullEvent.userId}`, fullEvent.id);
        await this.redisClient.lTrim(`auth:events:by_user:${fullEvent.userId}`, 0, 99); // 100 par user
      }

      // Statistiques par jour
      const dateKey = new Date().toISOString().split('T')[0];
      await this.redisClient.incr(`auth:stats:daily:${dateKey}:${fullEvent.type}`);
      await this.redisClient.expire(`auth:stats:daily:${dateKey}:${fullEvent.type}`, 2592000); // 30 jours

      this.logger.debug(`Event logged: ${fullEvent.type} - ${fullEvent.success ? 'SUCCESS' : 'FAILURE'}`);
    } catch (error) {
      this.logger.error(`Failed to log event: ${error.message}`);
    }
  }

  async getRecentEvents(limit: number = 50): Promise<AuthEvent[]> {
    if (!this.redisClient) return [];

    try {
      const eventIds = await this.redisClient.lRange('auth:events:recent', 0, limit - 1);
      const events: AuthEvent[] = [];

      for (const id of eventIds) {
        const eventData = await this.redisClient.get(`auth:events:${id}`);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      }

      return events;
    } catch (error) {
      this.logger.error(`Failed to get recent events: ${error.message}`);
      return [];
    }
  }

  async getEventsByType(type: string, limit: number = 50): Promise<AuthEvent[]> {
    if (!this.redisClient) return [];

    try {
      const eventIds = await this.redisClient.lRange(`auth:events:by_type:${type}`, 0, limit - 1);
      const events: AuthEvent[] = [];

      for (const id of eventIds) {
        const eventData = await this.redisClient.get(`auth:events:${id}`);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      }

      return events;
    } catch (error) {
      this.logger.error(`Failed to get events by type: ${error.message}`);
      return [];
    }
  }

  async getEventsByUser(userId: string, limit: number = 50): Promise<AuthEvent[]> {
    if (!this.redisClient) return [];

    try {
      const eventIds = await this.redisClient.lRange(`auth:events:by_user:${userId}`, 0, limit - 1);
      const events: AuthEvent[] = [];

      for (const id of eventIds) {
        const eventData = await this.redisClient.get(`auth:events:${id}`);
        if (eventData) {
          events.push(JSON.parse(eventData));
        }
      }

      return events;
    } catch (error) {
      this.logger.error(`Failed to get events by user: ${error.message}`);
      return [];
    }
  }

  async getStats(date?: string): Promise<Record<string, number>> {
    if (!this.redisClient) return {};

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const pattern = `auth:stats:daily:${targetDate}:*`;
      const keys = await this.redisClient.keys(pattern);
      
      const stats: Record<string, number> = {};
      
      for (const key of keys) {
        const count = await this.redisClient.get(key);
        const type = key.split(':').pop();
        if (type) {
          stats[type] = parseInt(count || '0');
        }
      }

      return stats;
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      return {};
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}