import { Socket } from 'socket.io-client';
import {
  COMPILER_ARBITRUM_COMPILE_COMPLETED_V1,
  COMPILER_ARBITRUM_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_ARBITRUM_COMPILE_LOGGED_V1,
  COMPILER_JUNO_COMPILE_COMPLETED_V1,
  COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_JUNO_COMPILE_LOGGED_V1,
  COMPILER_NEUTRON_COMPILE_COMPLETED_V1,
  COMPILER_NEUTRON_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_NEUTRON_COMPILE_LOGGED_V1,
} from 'wds-event';

export function cleanupSocketJuno(socketJuno: Socket) {
  const events = [
    'connect',
    'disconnect',
    'connect_error',
    COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
    COMPILER_JUNO_COMPILE_LOGGED_V1,
    COMPILER_JUNO_COMPILE_COMPLETED_V1,
  ];

  for (const event of events) {
    socketJuno.off(event);
  }
}

export function cleanupSocketNeutron(socketNeutron: Socket) {
  const events = [
    'connect',
    'disconnect',
    'connect_error',
    COMPILER_NEUTRON_COMPILE_ERROR_OCCURRED_V1,
    COMPILER_NEUTRON_COMPILE_LOGGED_V1,
    COMPILER_NEUTRON_COMPILE_COMPLETED_V1,
  ];

  for (const event of events) {
    socketNeutron.off(event);
  }
}

export function cleanupSocketArbitrum(socketNeutron: Socket) {
  const events = [
    'connect',
    'disconnect',
    'connect_error',
    COMPILER_ARBITRUM_COMPILE_ERROR_OCCURRED_V1,
    COMPILER_ARBITRUM_COMPILE_LOGGED_V1,
    COMPILER_ARBITRUM_COMPILE_COMPLETED_V1,
  ];

  for (const event of events) {
    socketNeutron.off(event);
  }
}
