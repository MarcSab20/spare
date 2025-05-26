// src/app.module.ts
import { Module } from '@nestjs/common';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { AuthModule } from './auth/auth.module.js'; // Nouveau module
import { join } from 'path';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
   
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'local'}`,
    }),
    
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD', ''),
        db: configService.get('REDIS_DB', 0),
        ttl: 300, 
        prefix: configService.get('REDIS_PREFIX', 'mu:auth:'),
      }),
    }),
    
    GraphQLModule.forRoot<ApolloDriverConfig>({
      autoSchemaFile: {
        path: join(process.cwd(), 'schema.gql'),
        federation: 2
      },
      buildSchemaOptions: { dateScalarMode: 'isoDate' },
      context: ({ req } : any) => ({ req }),
      playground: true,
      driver: ApolloFederationDriver, 
      introspection: true,  
    }),
    
    AuthorizationModule,
    AuthModule, // Ajout du nouveau module
  ],
  providers: [ConfigService],
})
export class AppModule {}