export const MOVEMENT_MAINNET_CHAIN = {
  chainId: '0xc01',
  chainName: 'Movement EVM',
};

export const MOVEMENT_TESTNET_CHAIN = {
  chainId: '0x781C',
  chainName: 'Movement EVM Testnet',
};

export const MOVEMENT_CURRENCY = {
  name: 'Movement',
  symbol: 'MOVE',
  decimals: 18,
};

export const MOVEMENT_NETWORKS = {
  MAINNET: {
    chainId: MOVEMENT_MAINNET_CHAIN.chainId,
    chainName: MOVEMENT_MAINNET_CHAIN.chainName,
    rpcUrls: ['https://mainnet.movementnetwork.xyz/v1'],
    blockExplorerUrls: ['https://explorer.movementlabs.xyz/?network=mainnet'],
    nativeCurrency: MOVEMENT_CURRENCY,
  },
  TESTNET: {
    chainId: MOVEMENT_TESTNET_CHAIN.chainId,
    chainName: MOVEMENT_TESTNET_CHAIN.chainName,
    rpcUrls: ['https://mevm.testnet.imola.movementlabs.xyz'],
    blockExplorerUrls: ['https://explorer.movementlabs.xyz/?network=bardock+testnet'],
    nativeCurrency: MOVEMENT_CURRENCY,
  },
};

export const MOVEMENT_RPC_URL = {
  MAINNET: 'https://movement.lava.build',
  TESTNET: 'https://mevm.testnet.imola.movementlabs.xyz',
};

export const MOVEMENT_EXPLORER_URL = {
  MAINNET: 'https://explorer.movementlabs.xyz/?network=mainnet',
  TESTNET: 'https://explorer.movementlabs.xyz/?network=bardock+testnet',
};
