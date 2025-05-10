import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TokenValidationDto {
  @Field()
  valid: boolean;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  givenName?: string;

  @Field({ nullable: true })
  familyName?: string;

  @Field(() => [String], { nullable: true })
  roles?: string[];
}