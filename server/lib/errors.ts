/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Thrown by domain-layer functions; routes translate this into the matching HTTP response. */
export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
