// ============================================================================
// Nakama Client Configuration
// Handles connection, authentication, and socket management
// ============================================================================

import { Client } from '@heroiclabs/nakama-js';

const NAKAMA_SERVER_KEY = 'defaultkey';
const NAKAMA_HOST = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
const NAKAMA_PORT = '7350';
const NAKAMA_USE_SSL = false;

export function createNakamaClient() {
  return new Client(NAKAMA_SERVER_KEY, NAKAMA_HOST, NAKAMA_PORT, NAKAMA_USE_SSL);
}

export function getDeviceId() {
  let deviceId = localStorage.getItem('ttt_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('ttt_device_id', deviceId);
  }
  return deviceId;
}

export async function authenticate(client, username) {
  const deviceId = getDeviceId();
  const session = await client.authenticateDevice(deviceId, true, username);
  return session;
}

export async function connectSocket(client, session) {
  const socket = client.createSocket(NAKAMA_USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}

// OpCodes matching server-side definitions
export const OpCode = {
  START: 1,
  UPDATE: 2,
  DONE: 3,
  MOVE: 4,
  REJECTED: 5,
  OPPONENT_LEFT: 6,
};
