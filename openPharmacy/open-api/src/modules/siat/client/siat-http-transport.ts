import { Injectable } from '@nestjs/common';
import * as http from 'node:http';
import * as https from 'node:https';
import { SiatUnavailableError } from './siat-errors';

export interface SiatTransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
}

export interface SiatTransportResponse {
  status: number;
  body: string;
}

/** Sends one HTTP POST. Injected so tests can replace the network. */
export interface SiatTransport {
  post(request: SiatTransportRequest): Promise<SiatTransportResponse>;
}

export const SIAT_TRANSPORT = Symbol('SIAT_TRANSPORT');

/**
 * Node HTTP(S) transport with two timeouts:
 *   - connect: the socket must connect within `connectTimeoutMs`. Nothing has been sent, so the outcome is `not-sent`.
 *   - total: the whole exchange must finish within `totalTimeoutMs`. If the request was already written, the outcome is `unknown`.
 */
@Injectable()
export class SiatHttpTransport implements SiatTransport {
  post(request: SiatTransportRequest): Promise<SiatTransportResponse> {
    const url = new URL(request.url);
    const lib = url.protocol === 'https:' ? https : http;
    const connectEvent =
      url.protocol === 'https:' ? 'secureConnect' : 'connect';

    return new Promise((resolve, reject) => {
      let written = false;
      let settled = false;

      const fail = (error: SiatUnavailableError) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        clearTimeout(totalTimer);
        req.destroy();
        reject(error);
      };

      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            ...request.headers,
            'Content-Length': Buffer.byteLength(request.body),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('error', (error) =>
            fail(
              new SiatUnavailableError(
                error.message,
                written ? 'unknown' : 'not-sent',
              ),
            ),
          );
          res.on('end', () => {
            if (settled) return;
            settled = true;
            clearTimeout(connectTimer);
            clearTimeout(totalTimer);
            resolve({
              status: res.statusCode ?? 0,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        },
      );

      const connectTimer = setTimeout(() => {
        fail(
          new SiatUnavailableError(
            `SIAT connect timeout after ${request.connectTimeoutMs} ms`,
            'not-sent',
          ),
        );
      }, request.connectTimeoutMs);

      const totalTimer = setTimeout(() => {
        fail(
          new SiatUnavailableError(
            `SIAT total timeout after ${request.totalTimeoutMs} ms`,
            written ? 'unknown' : 'not-sent',
          ),
        );
      }, request.totalTimeoutMs);

      req.on('socket', (socket) => {
        // The connect timer ends when the socket is connected (TLS handshake included for https).
        if (socket.connecting) {
          socket.once(connectEvent, () => clearTimeout(connectTimer));
        } else {
          clearTimeout(connectTimer);
        }
      });

      req.on('error', (error: NodeJS.ErrnoException) => {
        fail(
          new SiatUnavailableError(
            error.message,
            written ? 'unknown' : 'not-sent',
          ),
        );
      });

      req.end(request.body, () => {
        written = true;
      });
    });
  }
}
