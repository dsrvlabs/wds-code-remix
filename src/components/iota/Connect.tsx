import { useState } from 'react';
import { WalletConnect } from './WalletConnect';
import { Project } from './Project';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Connect as CommonConnect } from '../common/Connect';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}
interface InterfaceDapp {
  networks: any;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [wallet, setWallet] = useState('');
  const [account, setAccount] = useState('');
  const [dapp, setDapp] = useState<InterfaceDapp>();
  const [active, setActive] = useState<boolean>(false);

  return (
    <div>
      <CommonConnect
        client={client}
        active={active}
        setActive={setActive}
        chain={'iota'}
        setWallet={setWallet}
        wallet={wallet}
      />
      <div>
        <WalletConnect
          active={active}
          account={account}
          setAccount={setAccount}
          setDapp={setDapp}
          client={client}
          setActive={setActive}
          wallet={wallet}
        />
        <Project wallet={wallet} account={account} dapp={dapp} client={client} />
      </div>
    </div>
  );
};
