import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import pg from 'pg';

const { Client } = pg;

// Track connected SSE clients
const clients = new Set<FastifyReply>();

// PostgreSQL listener client (dedicated connection for LISTEN)
let listenerClient: pg.Client | null = null;
let isListening = false;

async function setupListener() {
  if (isListening) return;

  const connectionString = process.env.DATABASE_URL || 'postgres://mac@localhost:5432/nagoya_construction';

  listenerClient = new Client({ connectionString });

  try {
    await listenerClient.connect();

    // Subscribe to road_edit channel
    await listenerClient.query('LISTEN road_edit');

    // Handle notifications
    listenerClient.on('notification', (msg) => {
      if (msg.channel === 'road_edit' && msg.payload) {
        // Broadcast to all connected clients
        const data = `data: ${msg.payload}\n\n`;
        for (const client of clients) {
          try {
            client.raw.write(data);
          } catch (err) {
            // Client disconnected, remove from set
            clients.delete(client);
          }
        }
      }
    });

    // Handle connection errors
    listenerClient.on('error', async (err) => {
      console.error('PostgreSQL listener error:', err);
      isListening = false;
      // Attempt to reconnect after delay
      setTimeout(() => setupListener(), 5000);
    });

    isListening = true;
    console.log('PostgreSQL LISTEN established for road_edit channel');
  } catch (err) {
    console.error('Failed to setup PostgreSQL listener:', err);
    isListening = false;
    // Retry after delay
    setTimeout(() => setupListener(), 5000);
  }
}

export const sseRoutes: FastifyPluginAsync = async (app) => {
  // Initialize listener when routes are registered
  setupListener();

  // SSE endpoint for road edit notifications
  app.get('/road-edits', {
    schema: {
      description: 'Server-Sent Events stream for real-time road edit notifications',
      tags: ['SSE'],
      response: {
        200: {
          type: 'string',
          description: 'SSE stream',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection message
    reply.raw.write('data: {"type":"connected"}\n\n');

    // Add client to tracking set
    clients.add(reply);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        clients.delete(reply);
      }
    }, 30000);

    // Handle client disconnect
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(reply);
    });

    // Keep connection open (don't call reply.send())
    return reply;
  });

  // Endpoint to check SSE status
  app.get('/status', async () => {
    return {
      listening: isListening,
      connectedClients: clients.size,
    };
  });
};
