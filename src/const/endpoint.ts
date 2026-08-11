import { STAGE } from './stage';

const COMPILER_API_ENDPOINT_POOL = {
  local: 'http://localhost:8000',
  dev: 'https://dev.compiler.welldonestudio.io',
  prod: 'https://verify.welldonestudio.io',
};
export const COMPILER_API_ENDPOINT = COMPILER_API_ENDPOINT_POOL[STAGE];

// The prod host is named after near for historical reasons. It serves the Sui
// compiler socket, so it must survive the near teardown.
const SUI_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  prod: 'wss://prod.near.compiler.welldonestudio.io',
};
export const SUI_COMPILER_CONSUMER_ENDPOINT = SUI_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];
