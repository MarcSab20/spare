import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationRequestInput } from './dto/authorization-request.input.js';
import { AuthorizationResponseDto } from './dto/authorization-response.dto.js';
import { AuthorizationLogDto } from './dto/authorization-log.dto.js';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authService: AuthorizationService) {}

  @Query(() => AuthorizationResponseDto)
  async checkAccess(
    @Args('input') input: AuthorizationRequestInput,
    @Context() context: any
  ): Promise<AuthorizationResponseDto> {
    const authHeader = context.req?.headers?.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    
    if (token) {
      // Si un token est fourni, l'utiliser pour l'authentification
      return this.authService.checkAccessWithToken(token, input);
    }
    
    // Sinon, utiliser directement l'entrée OPA
    return this.authService.checkAccess(input);
  }

  @Query(() => [AuthorizationLogDto])
  async getAuthorizationHistory(
    @Args('userId', { nullable: true }) userId?: string,
    @Args('resourceId', { nullable: true }) resourceId?: string,
    @Args('limit', { nullable: true, defaultValue: 100 }) limit?: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number
  ): Promise<AuthorizationLogDto[]> {
    const logs = await this.authService.getAuthorizationHistory(
      userId,
      resourceId,
      limit,
      offset
    );
    
    return logs.map(log => ({
      userId: log.userId,
      resourceId: log.resourceId,
      resourceType: log.resourceType,
      action: log.action,
      allow: log.allow,
      reason: log.reason,
      context: log.context,
      timestamp: log.timestamp
    }));
  }
}