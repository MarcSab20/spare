import { Module } from '@nestjs/common';
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
@Module({
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
}