import { useCurrentAccount } from '@mysten/dapp-kit';
import { WalletConnect } from './WalletConnect';
import { Project } from './Project';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const account = useCurrentAccount();

  return (
    <div>
      <WalletConnect />
      <Project account={account?.address ?? ''} client={client} />
    </div>
  );
};
