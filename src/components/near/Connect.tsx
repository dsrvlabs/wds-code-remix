import { useState } from 'react';
import { WelldoneConnect } from './WelldoneConnect';
import { Project } from './Project';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Connect as CommonConnect } from '../common/Connect';
import { Near, providers } from 'near-api-js';
import { Provider } from './WalletRpcProvider';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

interface Account {
  address: string;
  pubKey: string;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [account, setAccount] = useState<Account>({ address: '', pubKey: '' });
  const [walletRpcProvider, setWalletRpcProvider] = useState<providers.WalletRpcProvider>();
  const [providerProxy, setProviderProxy] = useState<Provider>();
  const [nearConfig, setNearConfig] = useState<Near>();
  const [active, setActive] = useState<boolean>(false);

  return (
    <div>
      <CommonConnect client={client} active={active} setActive={setActive} />
      <hr />
      <div>
        <WelldoneConnect
          active={active}
          account={account}
          setAccount={setAccount}
          setWalletRpcProvider={setWalletRpcProvider}
          client={client}
          setActive={setActive}
          setNearConfig={setNearConfig}
          setProviderProxy={setProviderProxy}
        />
        <Project
          account={account}
          walletRpcProvider={walletRpcProvider}
          providerProxy={providerProxy}
          nearConfig={nearConfig}
          client={client}
        />
      </div>
    </div>
  );
};
