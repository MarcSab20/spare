
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationRequest } from './interfaces/authorization-request.interface.js';

@Controller()
export class AuthorizationController {
  private readonly logger = new Logger(AuthorizationController.name);

  constructor(private readonly authService: AuthorizationService) {}

  /**
   * Vérifie si une action est autorisée (gRPC)
   */
  @GrpcMethod('AuthorizationService', 'CheckAccess')
  async checkAccess(request: AuthorizationRequest) {
    this.logger.debug(`gRPC CheckAccess request: ${JSON.stringify(request)}`);
    
    try {
      const result = await this.authService.checkAccessWithUserId(
        request.userId,
        request.resourceId,
        request.resourceType,
        request.action,
        request.userAttributes,
        request.resourceAttributes,
        request.context
      );
      
      return {
        allowed: result.allowed,
        reason: result.reason || ''
      };
    } catch (error) {
      this.logger.error(`Error in CheckAccess: ${error instanceof Error ? error.message : String(error)}`);
      return {
        allowed: false,
        reason: 'Internal error during authorization check'
      };
    }
  }

  /**
   * Valide un token JWT et récupère les informations utilisateur
   */
  @GrpcMethod('AuthorizationService', 'ValidateToken')
  async validateToken(request: { token: string }) {
    try {
      const userInfo = await this.authService.validateToken(request.token);
      return {
        userId: userInfo.sub,
        email: userInfo.email || '',
        givenName: userInfo.given_name || '',
        familyName: userInfo.family_name || '',
        roles: userInfo.roles || [],
        attributes: this.flattenAttributes(userInfo.attributes || {}),
        organizationIds: userInfo.organization_ids || []
      };
    } catch (error) {
      this.logger.error(`Error in ValidateToken: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Récupère les informations d'un utilisateur par ID
   */
  @GrpcMethod('AuthorizationService', 'GetUserInfo')
  async getUserInfo(request: { userId: string }) {
    try {
      const userInfo = await this.authService.getUserInfo(request.userId);
      return {
        userId: userInfo.sub,
        email: userInfo.email || '',
        givenName: userInfo.given_name || '',
        familyName: userInfo.family_name || '',
        roles: userInfo.roles || [],
        attributes: this.flattenAttributes(userInfo.attributes || {}),
        organizationIds: userInfo.organization_ids || []
      };
    } catch (error) {
      this.logger.error(`Error in GetUserInfo: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Récupère les rôles d'un utilisateur
   */
  @GrpcMethod('AuthorizationService', 'GetUserRoles')
  async getUserRoles(request: { userId: string }) {
    try {
      const roles = await this.authService.getUserRoles(request.userId);
      return { roles };
    } catch (error) {
      this.logger.error(`Error in GetUserRoles: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Invalide le cache pour un utilisateur
   */
  @GrpcMethod('AuthorizationService', 'InvalidateUserCache')
  async invalidateUserCache(request: { userId: string }) {
    try {
      await this.authService.invalidateUserCache(request.userId);
      return { success: true, message: 'Cache invalidé avec succès' };
    } catch (error) {
      this.logger.error(`Error in InvalidateUserCache: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, message: `Erreur: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Convertit les attributs utilisateur en un format plat pour gRPC
   */
  private flattenAttributes(attributes: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) {
        continue;
      }
      
      if (typeof value === 'object') {
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    
    return result;
  }
}
