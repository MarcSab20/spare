import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthorizationService } from './authorization.service.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationResolver } from './authorization.resolver.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
  ],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    AuthorizationResolver
  ],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
