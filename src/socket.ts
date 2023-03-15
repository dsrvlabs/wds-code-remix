import { io } from 'socket.io-client';
import { JUNO_COMPILER_CONSUMER_ENDPOINT } from './const/endpoint';
import {
  COMPILER_JUNO_COMPILE_COMPLETED_V1,
  COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_JUNO_COMPILE_LOGGED_V1,
} from 'wds-event';

export const SOCKET = {
  JUNO: io(JUNO_COMPILER_CONSUMER_ENDPOINT),
};

export function cleanupSocketJuno() {
  const events = [
    'connect',
    'disconnect',
    'connect_error',
    COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
    COMPILER_JUNO_COMPILE_LOGGED_V1,
    COMPILER_JUNO_COMPILE_COMPLETED_V1,
  ];

  for (const event of events) {
    SOCKET.JUNO.off(event);
  }
}
