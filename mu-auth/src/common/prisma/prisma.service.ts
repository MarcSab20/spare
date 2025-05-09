import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  constructor(private configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    try {
      // Vérifier si le mode sans base de données est activé
      const skipDb = this.configService.get('SKIP_DB') === 'true';
      
      if (skipDb) {
        this.logger.warn('Skipping database connection as SKIP_DB=true');
        return;
      }
      
      await this.$connect();
      this.connected = true;
      this.logger.log('Connected to PostgreSQL database');
    } catch (error) {
      this.logger.warn(`Failed to connect to PostgreSQL database: ${error instanceof Error ? error.message : String(error)}`);
      this.logger.warn('Continuing without database - logging will be disabled');
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      try {
        await this.$disconnect();
        this.logger.log('Disconnected from PostgreSQL database');
      } catch (error) {
        this.logger.error(`Error during PostgreSQL disconnection: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}