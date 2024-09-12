import { STAGE } from './stage';

const COMPILER_API_ENDPOINT_POOL = {
  local: 'http://localhost:8000',
  dev: 'https://dev.compiler.welldonestudio.io',
  prod: 'https://verify.welldonestudio.io',
};
export const COMPILER_API_ENDPOINT = COMPILER_API_ENDPOINT_POOL[STAGE];

const NEAR_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  prod: 'wss://prod.near.compiler.welldonestudio.io',
};
export const NEAR_COMPILER_CONSUMER_ENDPOINT = NEAR_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const JUNO_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.neutron.compiler.welldonestudio.io',
  prod: 'wss://prod.neutron.compiler.welldonestudio.io',
};
export const JUNO_COMPILER_CONSUMER_ENDPOINT = JUNO_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const APTOS_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  // prod: 'wss://prod.aptos.compiler.welldonestudio.io',
  prod: 'wss://prod.near.compiler.welldonestudio.io',
};
export const APTOS_COMPILER_CONSUMER_ENDPOINT = APTOS_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const SUI_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  // prod: 'wss://prod.aptos.compiler.welldonestudio.io',
  prod: 'wss://prod.near.compiler.welldonestudio.io',
};
export const SUI_COMPILER_CONSUMER_ENDPOINT = SUI_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const NEUTRON_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.neutron.compiler.welldonestudio.io',
  prod: 'wss://prod.neutron.compiler.welldonestudio.io',
};
export const NEUTRON_COMPILER_CONSUMER_ENDPOINT = NEUTRON_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const NEUTRON_COMPILER_CONSUMER_API_ENDPOINT_POOL = {
  local: 'http://localhost:8000',
  dev: 'https://dev.neutron.compiler.welldonestudio.io',
  prod: 'https://prod.neutron.compiler.welldonestudio.io',
};

export const NEUTRON_COMPILER_CONSUMER_API_ENDPOINT =
  NEUTRON_COMPILER_CONSUMER_API_ENDPOINT_POOL[STAGE];
// ---
const INJECTIVE_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  prod: 'wss://prod.compiler.welldonestudio.io',
};
export const INJECTIVE_COMPILER_CONSUMER_ENDPOINT = INJECTIVE_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT_POOL = {
  local: 'http://localhost:8000',
  dev: 'https://dev.compiler.welldonestudio.io',
  prod: 'https://prod.compiler.welldonestudio.io',
};

export const INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT =
  INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT_POOL[STAGE];

const ARBITRUM_COMPILER_CONSUMER_ENDPOINT_POOL = {
  local: 'ws://localhost:8000',
  dev: 'wss://dev.compiler.welldonestudio.io',
  prod: 'wss://prod.near.compiler.welldonestudio.io',
};
export const ARBITRUM_COMPILER_CONSUMER_ENDPOINT = ARBITRUM_COMPILER_CONSUMER_ENDPOINT_POOL[STAGE];

const ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT_POOL = {
  local: 'http://localhost:8000',
  dev: 'https://dev.compiler.welldonestudio.io',
  prod: 'https://verify.welldonestudio.io',
};

export const ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT =
  ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT_POOL[STAGE];
