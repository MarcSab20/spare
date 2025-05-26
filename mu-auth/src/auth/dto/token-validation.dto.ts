import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
export class TokenValidationDto {
  @Field(() => Boolean, { description: "Indique si le token est valide" })
  valid: boolean;

  @Field(() => String, { nullable: true, description: "ID utilisateur" })
  userId?: string;

  @Field(() => String, { nullable: true, description: "Email de l'utilisateur" })
  email?: string;

  @Field(() => String, { nullable: true, description: "Prénom" })
  givenName?: string;

  @Field(() => String, { nullable: true, description: "Nom de famille" })
  familyName?: string;

  @Field(() => [String], { nullable: true, description: "Rôles de l'utilisateur" })
  roles?: string[];
}

@ObjectType()
export class UserAttributesDto {
  @Field(() => String, { nullable: true, description: "Département" })
  department?: string;

  @Field(() => Number, { nullable: true, description: "Niveau d'habilitation" })
  clearanceLevel?: number;

  @Field(() => String, { nullable: true, description: "Date d'expiration du contrat" })
  contractExpiryDate?: string;

  @Field(() => String, { nullable: true, description: "ID du manager" })
  managerId?: string;

  @Field(() => String, { nullable: true, description: "Titre du poste" })
  jobTitle?: string;

  @Field(() => String, { nullable: true, description: "Unité d'affaires" })
  businessUnit?: string;

  @Field(() => String, { nullable: true, description: "Juridiction territoriale" })
  territorialJurisdiction?: string;

  @Field(() => String, { nullable: true, description: "Expertise technique" })
  technicalExpertise?: string;

  @Field(() => Number, { nullable: true, description: "Niveau hiérarchique" })
  hierarchyLevel?: number;

  @Field(() => String, { nullable: true, description: "Lieu de travail" })
  workLocation?: string;

  @Field(() => String, { nullable: true, description: "Statut de vérification" })
  verificationStatus?: string;

  @Field(() => String, { nullable: true, description: "Type d'emploi" })
  employmentType?: string;

  @Field(() => Number, { nullable: true, description: "Score de risque" })
  riskScore?: number;

  @Field(() => [String], { nullable: true, description: "Certifications" })
  certifications?: string[];

  @Field(() => String, { nullable: true, description: "Prénom" })
  firstName?: string;

  @Field(() => String, { nullable: true, description: "Nom de famille" })
  lastName?: string;

  @Field(() => String, { nullable: true, description: "Numéro de téléphone" })
  phoneNumber?: string;

  @Field(() => String, { nullable: true, description: "Nationalité" })
  nationality?: string;

  @Field(() => String, { nullable: true, description: "Date de naissance" })
  dateOfBirth?: string;

  @Field(() => String, { nullable: true, description: "Genre" })
  gender?: string;

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Attributs supplémentaires" })
  additionalAttributes?: Record<string, any>;
}

@ObjectType()
export class UserInfoDto {
  @Field(() => String, { description: "Identifiant utilisateur (sub)" })
  sub: string;

  @Field(() => String, { nullable: true, description: "Email" })
  email?: string;

  @Field(() => String, { nullable: true, description: "Prénom" })
  given_name?: string;

  @Field(() => String, { nullable: true, description: "Nom de famille" })
  family_name?: string;

  @Field(() => String, { nullable: true, description: "Nom d'utilisateur préféré" })
  preferred_username?: string;

  @Field(() => [String], { description: "Rôles de l'utilisateur" })
  roles: string[];

  @Field(() => [String], { nullable: true, description: "IDs des organisations" })
  organization_ids?: string[];

  @Field(() => String, { nullable: true, description: "État de l'utilisateur" })
  state?: string;

  @Field(() => UserAttributesDto, { nullable: true, description: "Attributs utilisateur" })
  attributes?: UserAttributesDto;

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Accès aux ressources par client" })
  resource_access?: Record<string, { roles: string[] }>;

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Accès au realm" })
  realm_access?: { roles: string[] };
}

@ObjectType()
export class EnrichedTokenValidationDto {
  @Field(() => Boolean, { description: "Indique si le token est valide" })
  valid: boolean;

  @Field(() => UserInfoDto, { nullable: true, description: "Informations utilisateur complètes" })
  userInfo?: UserInfoDto;

  @Field(() => String, { nullable: true, description: "ID utilisateur" })
  userId?: string;

  @Field(() => String, { nullable: true, description: "Email" })
  email?: string;

  @Field(() => String, { nullable: true, description: "Prénom" })
  givenName?: string;

  @Field(() => String, { nullable: true, description: "Nom de famille" })
  familyName?: string;

  @Field(() => [String], { nullable: true, description: "Rôles" })
  roles?: string[];

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Données brutes Keycloak" })
  rawKeycloakData?: Record<string, any>;
}

@ObjectType()
export class ConnectionTestDto {
  @Field(() => Boolean, { description: "Indique si la connexion est établie" })
  connected: boolean;

  @Field(() => String, { nullable: true, description: "Informations sur la connexion" })
  info?: string;

  @Field(() => String, { nullable: true, description: "Message d'erreur" })
  error?: string;

  @Field(() => Number, { nullable: true, description: "Latence en millisecondes" })
  latency?: number;

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Détails supplémentaires" })
  details?: Record<string, any>;
}

@ObjectType()
export class AuthenticationLogDto {
  @Field(() => String, { description: "ID utilisateur" })
  userId: string;

  @Field(() => String, { description: "Action effectuée" })
  action: string;

  @Field(() => Boolean, { description: "Succès de l'action" })
  success: boolean;

  @Field(() => String, { description: "Timestamp" })
  timestamp: string;

  @Field(() => String, { nullable: true, description: "Adresse IP" })
  ip?: string;

  @Field(() => String, { nullable: true, description: "User Agent" })
  userAgent?: string;

  @Field(() => String, { nullable: true, description: "Message d'erreur" })
  error?: string;

  @Field(() => GraphQLJSONObject, { nullable: true, description: "Détails supplémentaires" })
  details?: Record<string, any>;
}