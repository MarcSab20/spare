import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginInputDto } from './dto/login-input.dto';
import { RefreshTokenInputDto } from './dto/refresh-token-input.dto';
import { 
  TokenValidationDto, 
  EnrichedTokenValidationDto, 
  UserInfoDto, 
  ConnectionTestDto,
  AuthenticationLogDto 
} from './dto/token-validation.dto';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly authorizationService: AuthorizationService
  ) {}

  /**
   * Authentification utilisateur
   */
  @Mutation(() => LoginResponseDto)
  async login(
    @Args('input') input: LoginInputDto,
    @Context() context?: any
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(input.username, input.password);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tokenType: result.token_type,
      expiresIn: result.expires_in
    };
  }

  /**
   * Rafraîchissement de token
   */
  @Mutation(() => LoginResponseDto)
  async refreshToken(@Args('input') input: RefreshTokenInputDto): Promise<LoginResponseDto> {
    const result = await this.authService.refreshToken(input.refreshToken);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tokenType: result.token_type,
      expiresIn: result.expires_in
    };
  }

  /**
   * Obtenir un token client credentials
   */
  @Mutation(() => LoginResponseDto)
  async getClientCredentialsToken(): Promise<LoginResponseDto> {
    const result = await this.authService.getClientCredentialsToken();
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tokenType: result.token_type,
      expiresIn: result.expires_in
    };
  }

  /**
   * Validation de token basique
   */
  @Query(() => TokenValidationDto)
  async validateToken(@Args('token') token: string): Promise<TokenValidationDto> {
    try {
      const result = await this.authService.validateToken(token);
      return {
        valid: result.valid,
        userId: result.userId,
        email: result.email,
        givenName: result.givenName,
        familyName: result.familyName,
        roles: result.roles
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Validation enrichie de token
   */
  @Query(() => EnrichedTokenValidationDto)
  async validateTokenEnriched(@Args('token') token: string): Promise<EnrichedTokenValidationDto> {
    try {
      const result = await this.authService.validateTokenEnriched(token);
      
      let userInfoDto: UserInfoDto | undefined;
      if (result.userInfo) {
        userInfoDto = this.mapUserInfoToDto(result.userInfo);
      }

      return {
        valid: result.valid,
        userInfo: userInfoDto,
        userId: result.userId,
        email: result.email,
        givenName: result.givenName,
        familyName: result.familyName,
        roles: result.roles,
        rawKeycloakData: result.rawKeycloakData
      };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Obtenir les informations utilisateur complètes
   */
  @Query(() => UserInfoDto, { nullable: true })
  async getUserInfo(@Args('userId') userId: string): Promise<UserInfoDto | null> {
    try {
      const userInfo = await this.authService.getUserInfo(userId);
      
      if (!userInfo) {
        return null;
      }

      return this.mapUserInfoToDto(userInfo);
    } catch (error) {
      return null;
    }
  }

  /**
   * Obtenir les rôles d'un utilisateur
   */
  @Query(() => [String])
  async getUserRoles(@Args('userId') userId: string): Promise<string[]> {
    try {
      return await this.authService.getUserRoles(userId);
    } catch (error) {
      return [];
    }
  }

  /**
   * Tester la connexion Redis
   */
  @Query(() => ConnectionTestDto)
  async testRedisConnection(): Promise<ConnectionTestDto> {
    try {
      return await this.authService.testRedisConnection();
    } catch (error) {
      return {
        connected: false,
        error: `Test Redis failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Tester la connexion Keycloak
   */
  @Query(() => ConnectionTestDto)
  async testKeycloakConnection(): Promise<ConnectionTestDto> {
    try {
      return await this.authService.testKeycloakConnection();
    } catch (error) {
      return {
        connected: false,
        error: `Test Keycloak failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Tester la connexion Authorization Service (Redis)
   */
  /* @Query(() => ConnectionTestDto)
  async testAuthorizationRedisConnection(): Promise<ConnectionTestDto> {
    try {
      const result = await this.authorizationService.testRedisConnection();
      return {
        connected: result.connected,
        info: result.info,
        error: result.error
      };
    } catch (error) {
      return {
        connected: false,
        error: `Authorization Redis test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } */

  /**
   * Invalider le cache utilisateur
   */
  @Mutation(() => Boolean)
  async invalidateUserCache(@Args('userId') userId: string): Promise<boolean> {
    try {
      await this.authService.invalidateUserCache(userId);
      // Invalider aussi dans le service d'autorisation
      await this.authorizationService.invalidateUserCache(userId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Déconnexion utilisateur
   */
  @Mutation(() => Boolean)
  async logout(@Args('token') token: string): Promise<boolean> {
    try {
      await this.authService.logout(token);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtenir l'historique d'authentification
   */
  @Query(() => [AuthenticationLogDto])
  async getAuthenticationHistory(
    @Args('userId', { nullable: true }) userId?: string,
    @Args('limit', { nullable: true, defaultValue: 100 }) limit?: number,
    @Args('offset', { nullable: true, defaultValue: 0 }) offset?: number
  ): Promise<AuthenticationLogDto[]> {
    try {
      // Cette méthode devrait être implémentée dans le service d'authentification
      // Pour l'instant, retourner un tableau vide
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Vérifier si un utilisateur est en ligne
   */
  @Query(() => Boolean)
  async isUserOnline(@Args('userId') userId: string): Promise<boolean> {
    try {
      // Cette logique devrait vérifier les sessions actives
      // Pour l'instant, retourner false
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtenir les statistiques d'authentification
   */
  @Query(() => ConnectionTestDto)
  async getAuthenticationStats(): Promise<ConnectionTestDto> {
    try {
      // Cette méthode devrait retourner des statistiques d'authentification
      // Pour l'instant, retourner un objet de base
      return {
        connected: true,
        info: 'Authentication service operational',
        details: {
          activeUsers: 0,
          totalLogins: 0,
          failedLogins: 0
        }
      };
    } catch (error) {
      return {
        connected: false,
        error: 'Failed to get authentication stats'
      };
    }
  }

  // === MÉTHODES PRIVÉES ===

  private mapUserInfoToDto(userInfo: any): UserInfoDto {
    return {
      sub: userInfo.sub,
      email: userInfo.email,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      preferred_username: userInfo.preferred_username,
      roles: userInfo.roles,
      organization_ids: userInfo.organization_ids,
      state: userInfo.state,
      attributes: userInfo.attributes ? {
        department: userInfo.attributes.department,
        clearanceLevel: userInfo.attributes.clearanceLevel,
        contractExpiryDate: userInfo.attributes.contractExpiryDate,
        managerId: userInfo.attributes.managerId,
        jobTitle: userInfo.attributes.jobTitle,
        businessUnit: userInfo.attributes.businessUnit,
        territorialJurisdiction: userInfo.attributes.territorialJurisdiction,
        technicalExpertise: userInfo.attributes.technicalExpertise,
        hierarchyLevel: userInfo.attributes.hierarchyLevel,
        workLocation: userInfo.attributes.workLocation,
        verificationStatus: userInfo.attributes.verificationStatus,
        employmentType: userInfo.attributes.employmentType,
        riskScore: userInfo.attributes.riskScore,
        certifications: userInfo.attributes.certifications,
        firstName: userInfo.attributes.firstName,
        lastName: userInfo.attributes.lastName,
        phoneNumber: userInfo.attributes.phoneNumber,
        nationality: userInfo.attributes.nationality,
        dateOfBirth: userInfo.attributes.dateOfBirth,
        gender: userInfo.attributes.gender,
        additionalAttributes: userInfo.attributes
      } : undefined,
      resource_access: userInfo.resource_access,
      realm_access: userInfo.realm_access
    };
  }
}