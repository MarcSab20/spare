import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationRequestInput } from './dto/authorization-request.input.js';
import { AuthorizationResponseDto } from './dto/authorization-response.dto.js';
import { AuthorizationLogDto } from './dto/authorization-log.dto.js';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authService: AuthorizationService) {}

  /**
   * Vérifie si une action est autorisée pour un utilisateur sur une ressource
   */
  @Query(() => AuthorizationResponseDto)
  async checkAccess(
    @Args('input') input: AuthorizationRequestInput,
    @Context() context: any
  ): Promise<AuthorizationResponseDto> {
    const authHeader = context.req?.headers?.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    
    if (token) {
      const result = await this.authService.checkAccessWithToken(
        token,
        input.resourceId,
        input.resourceType,
        input.action,
        input.resourceAttributes,
        input.context
      );
      
      return {
        allowed: result.allowed,
        reason: result.reason
      };
    }
    
    return this.authService.checkAccessWithUserId(
      input.userId,
      input.resourceId,
      input.resourceType,
      input.action,
      input.userAttributes,
      input.resourceAttributes,
      input.context
    );
  }
  /**
   * journalisation
   */
  @Query(() => [AuthorizationLogDto])
async getAuthorizationHistory(
  @Args('userId', { nullable: true }) userId?: string,
  @Args('resourceId', { nullable: true }) resourceId?: string,
  @Args('limit', { nullable: true, defaultValue: 100 }) limit?: number,
  @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number
): Promise<AuthorizationLogDto[]> {
  const rawData = await this.authService.getAuthorizationHistory(
    userId,
    resourceId,
    limit,
    offset
  );
  // Transforme les données en instances de AuthorizationLogDto
  return rawData.map(record => {
    const dto = new AuthorizationLogDto();
    dto.userId = record.userId;
    dto.resourceId = record.resourceId;
    dto.resourceType = record.resourceType;
    dto.action = record.action;
    dto.allowed = record.allowed;
    dto.reason = record.reason;
    dto.context = record.context;
    dto.timestamp = record.timestamp;
    return dto;
  });
}


}
