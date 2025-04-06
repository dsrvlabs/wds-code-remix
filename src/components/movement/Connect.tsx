import { useState } from 'react';
import { Project } from './Project';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Connect as CommonConnect } from '../common/Connect';
import { MetamaskConnect } from './MetamaskConnect';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [wallet, setWallet] = useState('');
  const [account, setAccount] = useState('');
  const [dapp, setDapp] = useState<any>();
  const [active, setActive] = useState<boolean>(false);

  return (
    <div>
      <CommonConnect
        client={client}
        active={active}
        setActive={setActive}
        chain={'movement'}
        setWallet={setWallet}
        wallet={wallet}
      />
      <div>
        <MetamaskConnect
          active={active}
          account={account}
          setAccount={setAccount}
          setDapp={setDapp}
          client={client}
          setActive={setActive}
        />
        <Project wallet={wallet} account={account} dapp={dapp} client={client} />
      </div>
    </div>
  );
};
