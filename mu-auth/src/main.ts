import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule);
  
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'authorization',
      protoPath: join(__dirname, '../protos/authorization.proto'),
      url: process.env.GRPC_SERVER_URL || '0.0.0.0:50050',
      maxSendMessageLength: 1024 * 1024 * 4, 
      maxReceiveMessageLength: 1024 * 1024 * 4, 
    },
  });
  
  await app.startAllMicroservices();
  
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`mu-auth service running on port ${port}`);
  logger.log(`gRPC service running on ${process.env.GRPC_SERVER_URL || '0.0.0.0:50050'}`);
  logger.log(`GraphQL playground available at http://localhost:${port}/graphql`);
}

bootstrap().catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
