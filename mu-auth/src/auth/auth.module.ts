/* import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
import { AuthorizationModule } from '../authorization/authorization.module';

/**
 * Module d'authentification enrichi
 * 
 * Fonctionnalités:
 * - Authentification Keycloak avec cache Redis
 * - Validation de tokens enrichie compatible OPA
 * - Gestion des sessions utilisateur
 * - Logging des événements d'authentification
 * - Support GraphQL et gRPC
 * - Tests de connectivité pour Keycloak et Redis
 */
/*@Module({
  imports: [
    ConfigModule,
    AuthorizationModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver
  ],
  exports: [AuthService],
})
export class AuthModule {
  constructor() {
    // Log des capacités du module au démarrage
    console.log('🔐 AuthModule initialized with features:');
    console.log('  ✓ Keycloak integration');
    console.log('  ✓ Redis caching');
    console.log('  ✓ OPA compatibility');
    console.log('  ✓ GraphQL & gRPC support');
    console.log('  ✓ Session management');
    console.log('  ✓ Authentication logging');
  }
} */

  import { Module } from '@nestjs/common';
  import { ConfigModule } from '@nestjs/config';
  import { ScheduleModule } from '@nestjs/schedule';
  import { AuthService } from './auth.service';
  import { AuthController } from './auth.controller';
  import { AuthResolver } from './auth.resolver';
  import { PostgresUserService } from './services/postgres-user.service';
  import { KeycloakPostgresSyncService } from './services/keycloak-postgres-sync.service';
  import { EventLoggerService } from './services/event-logger.service';        // ← Ajouter
  import { AuthorizationModule } from '../authorization/authorization.module';
  
  @Module({
    imports: [
      ConfigModule,
      ScheduleModule.forRoot(),
      AuthorizationModule
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      AuthResolver,
      PostgresUserService,
      KeycloakPostgresSyncService,
      EventLoggerService  
    ],
    exports: [AuthService, PostgresUserService, EventLoggerService],
  })
  export class AuthModule {
    constructor() {
      console.log('🔐 AuthModule initialized with PostgreSQL integration:');
      console.log('  ✓ Keycloak integration');
      console.log('  ✓ Redis caching');
      console.log('  ✓ PostgreSQL storage');
      console.log('  ✓ Bidirectional sync');
      console.log('  ✓ Event logging');
      console.log('  ✓ OPA compatibility');
      console.log('  ✓ GraphQL & gRPC support');
    }
  }  