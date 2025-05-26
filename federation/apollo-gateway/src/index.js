import { ApolloServer } from '@apollo/server';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import express from 'express';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import bodyParser from 'body-parser';
import { register, collectDefaultMetrics } from 'prom-client';

console.log('🚀 Démarrage d\'Apollo Gateway avec Fédération...');

// Métriques Prometheus
collectDefaultMetrics({ prefix: 'apollo_gateway_' });

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
});

async function startServer() {
  try {
    console.log('Initialisation du Gateway Apollo avec mu-auth...');
    console.log('Sous-graphe mu-auth: http://host.docker.internal:3001/graphql');
    
    const server = new ApolloServer({
      gateway,
      introspection: true,
      csrfPrevention: false,
      plugins: [
        {
          async serverWillStart() {
            console.log('Apollo Gateway fédéré initialisé avec succès');
          },
        },
      ],
    });

    await server.start();
    console.log('Gateway Apollo démarré avec fédération');
    
    const app = express();
    
    app.use(cors());
    app.use(bodyParser.json());
    
    // Endpoint GraphQL fédéré
    app.use('/graphql', expressMiddleware(server, {
      context: async ({ req }) => ({
        headers: req.headers,
        timestamp: new Date().toISOString(),
      })
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
      console.log(`Apollo Gateway Fédéré sur http://localhost:${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Metrics: http://localhost:${PORT}/metrics`);
      console.log(`GraphQL Fédéré: http://localhost:${PORT}/graphql`);
      console.log(`Debug: http://localhost:${PORT}/debug`);
      console.log(`Connecté au service mu-auth sur localhost:3001`);
    });

  } catch (error) {
    console.error('Erreur lors de l\'initialisation du Gateway:', error);
    process.exit(1);
  }
}

// Gestion des erreurs pour la fédération
process.on('unhandledRejection', (err) => {
  console.error('Erreur de fédération:', err);
});

startServer();