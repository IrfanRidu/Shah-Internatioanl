import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events stream of new/updated orders, so the admin dashboard
 * and notification bell can show "new order" the instant it's placed —
 * no manual refresh, no polling delay.
 *
 * Requires the MongoDB deployment to support Change Streams (i.e. a replica
 * set — MongoDB Atlas enables this by default; a bare standalone `mongod`
 * does not). If the change stream can't open, the client-side hook
 * (useOrderStream) transparently falls back to the existing 30s polling,
 * so nothing breaks on a non-replica-set database.
 */
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, 'orders', 'view')) {
    return new Response('Unauthorized', { status: 403 });
  }

  await connectDB();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event, data) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };

      send('connected', { ok: true });

      // Heartbeat so proxies/load balancers don't time out the idle connection.
      const heartbeat = setInterval(() => send('ping', { t: Date.now() }), 25000);

      let changeStream;
      try {
        changeStream = Order.watch([
          { $match: { operationType: { $in: ['insert', 'update'] } } },
        ], { fullDocument: 'updateLookup' });

        changeStream.on('change', (change) => {
          const doc = change.fullDocument;
          if (!doc) return;
          send(change.operationType === 'insert' ? 'order:new' : 'order:updated', {
            _id: doc._id,
            orderNumber: doc.orderNumber,
            total: doc.total,
            status: doc.status,
            orderType: doc.orderType,
          });
        });

        changeStream.on('error', () => send('stream:error', { message: 'Change stream error' }));
      } catch (e) {
        // Change Streams unsupported on this deployment (e.g. standalone Mongo) —
        // tell the client so it can fall back to polling.
        send('stream:unsupported', { message: 'Live updates unavailable on this database; falling back to polling.' });
      }

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        changeStream?.close().catch(() => {});
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
