import { PROD, STAGE } from '../const/stage';

const debug = STAGE === PROD ? () => {} : console.debug;

const error = console.error;

const info = console.info;

const log = {
  info,
  error,
  debug,
};

export { log };
