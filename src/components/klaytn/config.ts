interface InterfaceCeloConfig {
  networkId: string;
  rpcUrl: string;
  explorerUrl: string;
}

export const getConfig = (network: string): InterfaceCeloConfig => {
  switch (network) {
    case '0x2019':
      return {
        networkId: 'mainnet',
        rpcUrl: 'https://public-node-api.klaytnapi.com/v1/cypress',
        explorerUrl: 'https://scope.klaytn.com',
      };
    case '0x3e9':
    default:
      return {
        networkId: 'baobab',
        rpcUrl: 'https://public-node-api.klaytnapi.com/v1/baobab',
        explorerUrl: 'https://baobab.scope.klaytn.com',
      };
  }
};
