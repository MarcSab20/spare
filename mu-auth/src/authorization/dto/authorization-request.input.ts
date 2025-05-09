import { Field, InputType, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class AuthorizationRequestInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => ID, { description: "Identifiant de l'utilisateur" })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => ID, { description: "Identifiant de la ressource" })
  resourceId: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String, { description: "Type de ressource" })
  resourceType: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String, { description: "Action demandée" })
  action: string;

  @IsOptional()
  @Field(() => GraphQLJSONObject, { nullable: true, description: "Attributs utilisateur supplémentaires" })
  userAttributes?: Record<string, any>;

  @IsOptional()
  @Field(() => [String], { nullable: true, description: "Rôles de l'utilisateur" })
  userRoles?: string[];

  @IsOptional()
  @Field(() => [String], { nullable: true, description: "IDs des organisations de l'utilisateur" })
  organizationIds?: string[];

  @IsOptional()
  @Field(() => GraphQLJSONObject, { nullable: true, description: "Attributs ressource supplémentaires" })
  resourceAttributes?: Record<string, any>;

  @IsOptional()
  @Field(() => GraphQLJSONObject, { nullable: true, description: "Contexte supplémentaire" })
  context?: Record<string, any>;
}
