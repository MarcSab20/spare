// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthResolver
  ],
  exports: [AuthService],
})
export class AuthModule {}