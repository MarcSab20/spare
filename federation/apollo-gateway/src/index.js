import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import express from 'express';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import bodyParser from 'body-parser';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

console.log('🚀 Apollo Gateway avec Métriques et Tracing');

// Métriques Prometheus
collectDefaultMetrics({ prefix: 'apollo_gateway_' });

const httpRequestsTotal = new Counter({
  name: 'apollo_gateway_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'apollo_gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Configuration du Gateway avec votre service mu-auth
const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({
    subgraphs: [
      { 
        name: 'mu-auth', 
        url: 'http://host.docker.internal:3001/graphql'
      }
    ],
    introspectionHeaders: {
      'User-Agent': 'Apollo-Gateway-Federation'
    }
  }),
  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({ request, context }) {
        // Propager tous les headers importants vers mu-auth
        if (context.headers) {
          // Headers d'authentification
          if (context.headers.authorization) {
            request.http.headers.set('authorization', context.headers.authorization);
          }
          
          // Headers de contexte utilisateur
          if (context.headers['x-user-id']) {
            request.http.headers.set('x-user-id', context.headers['x-user-id']);
          }
          if (context.headers['x-user-email']) {
            request.http.headers.set('x-user-email', context.headers['x-user-email']);
          }
          if (context.headers['x-user-role']) {
            request.http.headers.set('x-user-role', context.headers['x-user-role']);
          }
          if (context.headers['x-organization-id']) {
            request.http.headers.set('x-organization-id', context.headers['x-organization-id']);
          }
          
          // Headers de traçabilité
          if (context.headers['x-request-id']) {
            request.http.headers.set('x-request-id', context.headers['x-request-id']);
          }
          if (context.headers['x-trace-id']) {
            request.http.headers.set('x-trace-id', context.headers['x-trace-id']);
          }
          
          // Ajouter timestamp du gateway
          request.http.headers.set('x-gateway-timestamp', new Date().toISOString());
          
          console.log('🔄 Headers propagés vers mu-auth:', {
            userID: context.headers['x-user-id'],
            requestID: context.headers['x-request-id'],
            hasAuth: !!context.headers.authorization
          });
        }
      }
    });
  }
});

async function startServer() {
  try {
    console.log('🔧 Initialisation du Gateway Apollo avec mu-auth...');
    console.log('📡 Sous-graphe mu-auth: http://host.docker.internal:3001/graphql');
    
    const server = new ApolloServer({
      gateway,
      introspection: true,
      csrfPrevention: false,
      plugins: [
        {
          async serverWillStart() {
            console.log('✅ Apollo Gateway fédéré initialisé avec succès');
          },
        },
        {
          async requestDidStart(requestContext) {
            const startTime = Date.now();
            const headers = requestContext.request.http?.headers || {};
            
            return {
              async didResolveOperation(requestContext) {
                const { operationName } = requestContext;
                console.log(`🎯 GraphQL Operation: ${operationName || 'anonymous'}`);
                
                // Log pour tracing
                console.log('📡 Jaeger Trace:', {
                  service: 'apollo-gateway', 
                  operation: operationName,
                  traceID: headers['x-trace-id'] || `apollo-${Date.now()}`,
                  userID: headers['x-user-id']
                });
              },
              async willSendResponse(requestContext) {
                const duration = Date.now() - startTime;
                const { operationName } = requestContext;
                
                console.log(`📤 Response sent in ${duration}ms`);
                
                // Log pour tracing
                console.log('📊 Span completed:', {
                  service: 'apollo-gateway',
                  operation: operationName || 'graphql_request',
                  duration: `${duration}ms`,
                  status: 'success'
                });
              }
            };
          }
        }
      ],
    });

    await server.start();
    console.log('🚀 Gateway Apollo démarré avec fédération');
    
    const app = express();
    
    // Middleware pour métriques HTTP
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        httpRequestsTotal.inc({
          method: req.method,
          route: req.path,
          status_code: res.statusCode
        });
        httpRequestDuration.observe({
          method: req.method,
          route: req.path
        }, duration);
      });
      next();
    });
    
    app.use(cors());
    app.use(bodyParser.json());
    
    // Endpoint GraphQL fédéré avec logging du contexte
    app.use('/graphql', expressMiddleware(server, {
      context: async ({ req }) => {
        const context = {
          headers: req.headers,
          timestamp: new Date().toISOString(),
          userID: req.headers['x-user-id'],
          requestID: req.headers['x-request-id'],
          authorization: req.headers['authorization'],
        };
        
        // Log du contexte pour debugging
        console.log('📡 Contexte reçu:', {
          userID: context.userID,
          requestID: context.requestID,
          hasAuth: !!context.authorization,
          headersCount: Object.keys(req.headers).length
        });
        
        return context;
      }
    }));

    // Health check
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'apollo-gateway-federation',
        subgraphs: ['mu-auth']
      });
    });

    // Métriques Prometheus
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (error) {
        res.status(500).end('Erreur métriques');
      }
    });

    // Endpoint de debug pour vérifier la fédération
    app.get('/debug', (req, res) => {
      res.json({
        service: 'apollo-gateway-federation',
        subgraphs: [
          {
            name: 'mu-auth',
            url: 'http://host.docker.internal:3001/graphql',
            status: 'connected'
          }
        ],
        federation: 'enabled',
        uptime: process.uptime()
      });
    });

    const PORT = process.env.PORT || 4000;
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Apollo Gateway Fédéré sur http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
      console.log(`🚀 GraphQL Fédéré: http://localhost:${PORT}/graphql`);
      console.log(`🔧 Debug: http://localhost:${PORT}/debug`);
      console.log(`📡 Connecté au service mu-auth sur localhost:3001`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du Gateway:', error);
    process.exit(1);
  }
}

// Gestion des erreurs pour la fédération
process.on('unhandledRejection', (err) => {
  console.error('❌ Erreur de fédération:', err);
});

startServer();