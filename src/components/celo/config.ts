interface InterfaceCeloConfig {
  networkId: string;
  forno: string;
  explorerUrl: string;
}

export const getConfig = (network: string): InterfaceCeloConfig => {
  switch (network) {
    case '0xa4ec':
      return {
        networkId: 'mainnet',
        forno: 'https://forno.celo.org',
        explorerUrl: 'https://celoscan.io',
      };
    case '0xaef3':
      return {
        networkId: 'alfajores',
        forno: 'https://alfajores-forno.celo-testnet.org',
        explorerUrl: 'https://alfajores.celoscan.io',
      };
    case '0xf370':
    default:
      return {
        networkId: 'baklaba',
        forno: 'https://baklava-forno.celo-testnet.org',
        explorerUrl: 'https://explorer.testnet.near.org',
      };
  }
};
