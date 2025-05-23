export interface OPAConfig {
  url: string;
  policyPath: string;
  timeout?: number;
}

/**
 * Structure d'entrée pour Open Policy Agent utilisée pour les décisions d'autorisation
 */
export interface OPAInput {
  user: {
    id: string;
    roles: string[];
    organization_ids?: string[];
    state?: string;
    attributes?: {
      department?: string;
      clearanceLevel?: number;
      contractExpiryDate?: string;
      managerId?: string;
      [key: string]: any;
    };
  };
  resource: {
    id: string;
    type: string;
    owner_id?: string;
    organization_id?: string;
    attributes?: {
      isOfficial?: boolean;
      department?: string;
      confidential?: boolean;
      requiredClearance?: number;
      state?: string;
      targetState?: string;
      [key: string]: any;
    };
  };
  action: string;
  context?: {
    ip?: string;
    businessHours?: boolean;
    currentDate?: string;
    riskScore?: number;
    managementHierarchy?: Record<string, string>;
    [key: string]: any;
  };
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