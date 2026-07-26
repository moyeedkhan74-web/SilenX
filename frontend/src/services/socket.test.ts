import { describe, expect, it } from 'vitest';
import { shouldReconnectSocket } from './socket';

describe('shouldReconnectSocket', () => {
  it('returns true for disconnected sockets', () => {
    const socket = {
      connected: false,
      disconnected: true,
    } as any;

    expect(shouldReconnectSocket(socket)).toBe(true);
  });

  it('returns false for connected sockets', () => {
    const socket = {
      connected: true,
      disconnected: false,
    } as any;

    expect(shouldReconnectSocket(socket)).toBe(false);
  });
});
