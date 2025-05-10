// src/auth/auth.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginInputDto } from './dto/login-input.dto';
import { RefreshTokenInputDto } from './dto/refresh-token-input.dto';
import { TokenValidationDto } from './dto/token-validation.dto';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authentification utilisateur
   */
  @Mutation(() => LoginResponseDto)
  async login(@Args('input') input: LoginInputDto): Promise<LoginResponseDto> {
    const result = await this.authService.login(input.username, input.password);
    return {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      tokenType: 'Bearer'
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
      tokenType: 'Bearer'
    };
  }

  /**
   * Validation de token
   */
  @Query(() => TokenValidationDto)
  async validateToken(@Args('token') token: string): Promise<TokenValidationDto> {
    try {
      const userInfo = await this.authService.validateToken(token);
      return {
        valid: true,
        userId: userInfo.userId,
        email: userInfo.email,
        givenName: userInfo.givenName,
        familyName: userInfo.familyName,
        roles: userInfo.roles
      };
    } catch (error) {
      return { valid: false };
    }
  }
}