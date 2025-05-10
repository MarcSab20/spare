export interface OPAConfig {
    url: string;            
    policyPath: string;     
    timeout?: number;       
  }
  
  export interface OPAInput {
    user: {
      id: string;          
      roles: string[];     
      attributes?: Record<string, any>; 
      organization_ids?: string[]; 
    };
    resource: {
      id: string;          
      type: string;        
      attributes?: Record<string, any>; 
      owner_id?: string;    
      organization_id?: string;
    };
    action: string;        
    context?: Record<string, any>; 
  }
  
  /**
   * Résultat d'une évaluation de politique OPA
   */
  export interface OPAResult {
    allow: boolean;         
    reason?: string;        
  }
  
  /**
   * Client pour interagir avec OPA
   */
  export interface OPAClient {

    checkPermission(input: OPAInput): Promise<OPAResult>;
    
    updatePolicy(policyId: string, policy: string): Promise<void>;
    
    getPolicy(policyId: string): Promise<string>;
  }