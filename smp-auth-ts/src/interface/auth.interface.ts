export interface IAuthenticationService {
    login(username: string, password: string): Promise<AuthResponse>;
    refreshToken(refreshToken: string): Promise<AuthResponse>;
    validateToken(token: string): Promise<boolean>;
    getClientCredentialsToken(): Promise<AuthResponse>;
    logout(token: string): Promise<void>;
  }
  
  export interface AuthResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
  }