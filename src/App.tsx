import React, { useState, useEffect } from 'react';
import { Main } from './components/Main';
import './panel.css';

import type { Api } from '@remixproject/plugin-utils';
import { Client } from '@remixproject/plugin';
import { IRemixApi } from '@remixproject/plugin-api';
import { createClient } from '@remixproject/plugin-iframe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { log } from './utils/logger';

const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  devnet: { url: getFullnodeUrl('devnet') },
});

const queryClient = new QueryClient();

export const App: React.FunctionComponent = () => {
  const [client, setClient] = useState<Client<Api, Readonly<IRemixApi>> | undefined | null>(null);
  const [connection, setConnection] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const temp = createClient();
      await temp.onload();

      setClient(temp);
      setConnection(true);
    };
    if (!connection) init();
    log.debug(`%cẅël̈l̈c̈öm̈ë-̈ẗö-̈ẅël̈l̈d̈ön̈ë-̈c̈öd̈ë!̈`, 'color:yellow');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <div className="App wds-panel">{client && <Main client={client} />}</div>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
};

export default App;
