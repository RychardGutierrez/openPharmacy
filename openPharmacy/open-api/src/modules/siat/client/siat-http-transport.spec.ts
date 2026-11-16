import * as http from 'node:http';
import * as net from 'node:net';
import type { AddressInfo } from 'node:net';
import { SiatUnavailableError } from './siat-errors';
import { SiatHttpTransport } from './siat-http-transport';

/** Local test server only. No request leaves the machine. */
function startServer(
  handler: http.RequestListener,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}/svc`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

describe('SiatHttpTransport', () => {
  const transport = new SiatHttpTransport();
  const base = {
    headers: { 'Content-Type': 'text/xml' },
    body: '<x/>',
    connectTimeoutMs: 1000,
  };

  it('posts the body and returns status and body', async () => {
    const server = await startServer((req, res) => {
      let received = '';
      req.on('data', (chunk: Buffer) => (received += chunk.toString()));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(`echo:${received}`);
      });
    });

    try {
      const response = await transport.post({
        ...base,
        url: server.url,
        totalTimeoutMs: 2000,
      });

      expect(response).toEqual({ status: 200, body: 'echo:<x/>' });
    } finally {
      await server.close();
    }
  });

  it('reports a total timeout after the request was sent as outcome "unknown"', async () => {
    const server = await startServer((_req, res) => {
      setTimeout(() => res.end('late'), 500);
    });

    try {
      const error = await transport
        .post({ ...base, url: server.url, totalTimeoutMs: 100 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SiatUnavailableError);
      expect((error as SiatUnavailableError).outcome).toBe('unknown');
      expect((error as SiatUnavailableError).message).toMatch(/total timeout/);
    } finally {
      await server.close();
    }
  });

  it('reports a connect timeout as outcome "not-sent" (TLS handshake never completes)', async () => {
    // Local TCP server that accepts the connection and never answers the TLS handshake.
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => sockets.push(socket));
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const { port } = server.address() as AddressInfo;

    try {
      const error = await transport
        .post({
          ...base,
          url: `https://127.0.0.1:${port}/svc`,
          connectTimeoutMs: 150,
          totalTimeoutMs: 5000,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SiatUnavailableError);
      expect((error as SiatUnavailableError).outcome).toBe('not-sent');
      expect((error as SiatUnavailableError).message).toMatch(
        /connect timeout after 150 ms/,
      );
    } finally {
      sockets.forEach((socket) => socket.destroy());
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('reports a refused connection as outcome "not-sent"', async () => {
    // Open and close a server to get a port that nothing listens on.
    const server = await startServer((_req, res) => res.end());
    const url = server.url;
    await server.close();

    const error = await transport
      .post({ ...base, url, totalTimeoutMs: 2000 })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SiatUnavailableError);
    expect((error as SiatUnavailableError).outcome).toBe('not-sent');
  });
});
