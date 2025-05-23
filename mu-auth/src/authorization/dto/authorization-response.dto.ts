import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuthorizationResponseDto {
  @Field(() => Boolean, { description: "Indique si l'accès est autorisé" })
  allow: boolean;

  @Field(() => String, { nullable: true, description: "Raison de la décision" })
  reason?: string;
}