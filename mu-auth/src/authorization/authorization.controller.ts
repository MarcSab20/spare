import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthorizationService } from './authorization.service.js';
import { OPAInput } from 'smp-auth-ts';

@Controller()
export class AuthorizationController {
  private readonly logger = new Logger(AuthorizationController.name);

  constructor(private readonly authService: AuthorizationService) {}

  @GrpcMethod('AuthorizationService', 'CheckAccess')
  async checkAccess(request: any) {
    this.logger.debug(`gRPC CheckAccess request: ${JSON.stringify(request)}`);
    
    try {
      // Transformer la requête gRPC en entrée OPA
      const opaInput: OPAInput = {
        user: {
          id: request.userId,
          roles: request.userRoles || [],
          organization_ids: request.organizationIds,
          attributes: this.parseAttributes(request.userAttributes)
        },
        resource: {
          id: request.resourceId,
          type: request.resourceType,
          owner_id: request.resourceOwnerId,
          organization_id: request.resourceOrganizationId,
          attributes: this.parseAttributes(request.resourceAttributes)
        },
        action: request.action,
        context: this.parseAttributes(request.context)
      };
      
      const result = await this.authService.checkAccess(opaInput);
      
      return {
        allow: result.allow,
        reason: result.reason || ''
      };
    } catch (error) {
      this.logger.error(`Error in CheckAccess: ${error instanceof Error ? error.message : String(error)}`);
      return {
        allow: false,
        reason: 'Internal error during authorization check'
      };
    }
  }

  @GrpcMethod('AuthorizationService', 'ValidateToken')
  async validateToken(request: { token: string }) {
    try {
      const userInfo = await this.authService.validateToken(request.token);
      return {
        userId: userInfo.sub,
        email: userInfo.email || '',
        roles: userInfo.roles || [],
        attributes: this.flattenAttributes(userInfo.attributes || {}),
        organizationIds: userInfo.organization_ids || []
      };
    } catch (error) {
      this.logger.error(`Error in ValidateToken: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  @GrpcMethod('AuthorizationService', 'UpdatePolicy')
  async updatePolicy(request: { policyId: string; policyContent: string }) {
    try {
      await this.authService.updatePolicy(request.policyId, request.policyContent);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error in UpdatePolicy: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  @GrpcMethod('AuthorizationService', 'GetPolicy')
  async getPolicy(request: { policyId: string }) {
    try {
      const policy = await this.authService.getPolicy(request.policyId);
      return { policy };
    } catch (error) {
      this.logger.error(`Error in GetPolicy: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Méthodes utilitaires
  private parseAttributes(attributes: Record<string, string> = {}): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      try {
        // Essayer de parser les valeurs JSON
        result[key] = JSON.parse(value);
      } catch {
        // Si ce n'est pas du JSON, utiliser la valeur telle quelle
        result[key] = value;
      }
    }
    
    return result;
  }

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