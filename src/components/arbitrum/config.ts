interface InterfaceArbitrumConfig {
  networkId: string;
  forno: string;
  explorerUrl: string;
}

export const getConfig = (network: string): InterfaceArbitrumConfig => {
  switch (network) {
    case '0xcb6bab':
    default:
      return {
        networkId: 'Stylus Testnet v2',
        forno: 'https://baklava-forno.celo-testnet.org',
        explorerUrl: 'https://stylusv2-explorer.arbitrum.io',
      };
  }
};
