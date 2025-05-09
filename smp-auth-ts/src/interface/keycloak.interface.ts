export interface KeycloakConfig {
    url: string;            // ( http://keycloak:8080/auth)
    realm: string;         
    clientId: string;       
    clientSecret: string;   
    timeout?: number;       
  }
  
  export interface UserInfo {
    sub: string;            
    email?: string;         
    given_name?: string;    
    family_name?: string;   
    roles: string[];        
    attributes?: Record<string, any>; 
    resource_access?: Record<string, { roles: string[] }>; 
    organization_ids?: string[]; // (peut être extrait des attributs)
  }
  
  export interface KeycloakClient {
    
    validateToken(token: string): Promise<UserInfo>;
    
    getRoles(userId: string): Promise<string[]>;
    
    getUserInfo(userId: string): Promise<UserInfo>;
    
    getAdminToken(): Promise<string>;
  }