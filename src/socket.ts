import { Socket } from 'socket.io-client';
import {
  COMPILER_JUNO_COMPILE_COMPLETED_V1,
  COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_JUNO_COMPILE_LOGGED_V1,
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
