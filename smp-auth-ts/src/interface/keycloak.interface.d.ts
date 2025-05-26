import { UserInfo, UserAttributes } from './auth.interface.js';
export interface KeycloakConfig {
    url: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    timeout?: number;
    adminClientId?: string;
    adminClientSecret?: string;
    enableCache?: boolean;
    cacheExpiry?: number;
}
export interface KeycloakClient {
    validateToken(token: string): Promise<UserInfo>;
    getRoles(userId: string): Promise<string[]>;
    getUserInfo(userId: string): Promise<UserInfo>;
    getAdminToken(): Promise<string>;
}
export interface KeycloakClientExtended extends KeycloakClient {
    validateTokenRaw(token: string): Promise<KeycloakTokenIntrospection>;
    getUserData(userId: string): Promise<KeycloakUserData>;
    refreshAdminToken(): Promise<string>;
    createUser(userData: Partial<KeycloakUserData>): Promise<string>;
    updateUser(userId: string, userData: Partial<KeycloakUserData>): Promise<void>;
    deleteUser(userId: string): Promise<void>;
    enableUser(userId: string): Promise<void>;
    disableUser(userId: string): Promise<void>;
    assignRoles(userId: string, roles: string[]): Promise<void>;
    removeRoles(userId: string, roles: string[]): Promise<void>;
    getUserRealmRoles(userId: string): Promise<string[]>;
    getUserClientRoles(userId: string, clientId: string): Promise<string[]>;
    addUserToGroup(userId: string, groupId: string): Promise<void>;
    removeUserFromGroup(userId: string, groupId: string): Promise<void>;
    getUserGroups(userId: string): Promise<string[]>;
    getUserSessions(userId: string): Promise<any[]>;
    logoutUser(userId: string): Promise<void>;
    logoutAllSessions(userId: string): Promise<void>;
    searchUsers(query: string, limit?: number): Promise<KeycloakUserData[]>;
    getUserByUsername(username: string): Promise<KeycloakUserData | null>;
    getUserByEmail(email: string): Promise<KeycloakUserData | null>;
    healthCheck(): Promise<boolean>;
    getServerInfo(): Promise<any>;
}
export interface KeycloakTokenIntrospection {
    active: boolean;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
    preferred_username?: string;
    realm_access?: {
        roles: string[];
    };
    resource_access?: {
        [clientId: string]: {
            roles: string[];
        };
    };
    scope?: string;
    client_id?: string;
    username?: string;
    token_type?: string;
    exp?: number;
    iat?: number;
    nbf?: number;
    aud?: string | string[];
    iss?: string;
    jti?: string;
    organization_ids?: string | string[];
    department?: string | string[];
    clearance_level?: string | number;
    contract_expiry_date?: string;
    manager_id?: string;
    job_title?: string;
    business_unit?: string;
    territorial_jurisdiction?: string;
    technical_expertise?: string;
    hierarchy_level?: string | number;
    work_location?: string;
    verification_status?: string;
    employment_type?: string;
    user_state?: string;
    risk_score?: string | number;
    [key: string]: any;
}
export interface KeycloakUserData {
    id: string;
    username: string;
    email?: string;
    emailVerified?: boolean;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    createdTimestamp?: number;
    attributes?: {
        [key: string]: string[];
    };
    groups?: string[];
    realmRoles?: string[];
    clientRoles?: {
        [clientId: string]: string[];
    };
    federatedIdentities?: Array<{
        identityProvider: string;
        userId: string;
        userName: string;
    }>;
    disableableCredentialTypes?: string[];
    requiredActions?: string[];
    notBefore?: number;
    access?: {
        manageGroupMembership: boolean;
        view: boolean;
        mapRoles: boolean;
        impersonate: boolean;
        manage: boolean;
    };
}
export interface KeycloakQueryOptions {
    limit?: number;
    offset?: number;
    search?: string;
    exact?: boolean;
    enabled?: boolean;
    briefRepresentation?: boolean;
}
export interface KeycloakUserMapper {
    mapTokenIntrospectionToUserInfo(data: KeycloakTokenIntrospection): UserInfo;
    mapUserDataToUserInfo(data: KeycloakUserData): UserInfo;
    mapAttributesToUserAttributes(attributes: {
        [key: string]: string[];
    }): UserAttributes;
    extractOrganizationIds(data: KeycloakTokenIntrospection | KeycloakUserData): string[];
    extractRoles(data: KeycloakTokenIntrospection | KeycloakUserData): string[];
}
export interface KeycloakAttributeConfig {
    organizationIdsAttribute: string;
    departmentAttribute: string;
    clearanceLevelAttribute: string;
    contractExpiryAttribute: string;
    managerIdAttribute: string;
    jobTitleAttribute: string;
    businessUnitAttribute: string;
    workLocationAttribute: string;
    verificationStatusAttribute: string;
    employmentTypeAttribute: string;
    riskScoreAttribute: string;
    customAttributeMapping: {
        [keycloakAttribute: string]: string;
    };
}
export declare class ExtendedKeycloakClient implements KeycloakClientExtended {
    private baseClient;
    private config;
    constructor(baseClient: KeycloakClient, config: KeycloakConfig);
    validateToken(token: string): Promise<UserInfo>;
    getRoles(userId: string): Promise<string[]>;
    getUserInfo(userId: string): Promise<UserInfo>;
    getAdminToken(): Promise<string>;
    validateTokenRaw(token: string): Promise<KeycloakTokenIntrospection>;
    getUserData(userId: string): Promise<KeycloakUserData>;
    refreshAdminToken(): Promise<string>;
    createUser(userData: Partial<KeycloakUserData>): Promise<string>;
    updateUser(userId: string, userData: Partial<KeycloakUserData>): Promise<void>;
    deleteUser(userId: string): Promise<void>;
    enableUser(userId: string): Promise<void>;
    disableUser(userId: string): Promise<void>;
    assignRoles(userId: string, roles: string[]): Promise<void>;
    removeRoles(userId: string, roles: string[]): Promise<void>;
    getUserRealmRoles(userId: string): Promise<string[]>;
    getUserClientRoles(userId: string, clientId: string): Promise<string[]>;
    addUserToGroup(userId: string, groupId: string): Promise<void>;
    removeUserFromGroup(userId: string, groupId: string): Promise<void>;
    getUserGroups(userId: string): Promise<string[]>;
    getUserSessions(userId: string): Promise<any[]>;
    logoutUser(userId: string): Promise<void>;
    logoutAllSessions(userId: string): Promise<void>;
    searchUsers(query: string, limit?: number): Promise<KeycloakUserData[]>;
    getUserByUsername(username: string): Promise<KeycloakUserData | null>;
    getUserByEmail(email: string): Promise<KeycloakUserData | null>;
    healthCheck(): Promise<boolean>;
    getServerInfo(): Promise<any>;
}
