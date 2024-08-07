import { useState } from 'react';
import { KeplrConnect } from './KeplrConnect';
import { Project } from './Project';
import { ListGroup } from 'react-bootstrap';

import Keplr from '../../assets/Keplr-Big.svg';

interface InterfaceProps {
  client: any;
}
export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [dapp, setDapp] = useState<any>();
  const [keplr, setKeplr] = useState<any>();
  const [wallet, setWallet] = useState('');
  const [account, setAccount] = useState('');
  const [walletRpcProvider, setWalletRpcProvider] = useState<any>();
  const [activeWallet, setActiveWallet] = useState('');
  const [active, setActive] = useState(false);
  const [providerNetwork, setProviderNetwork] = useState<string>('injective-888');
  return (
    <div>
      <ListGroup>
        <ListGroup.Item
          as="li"
          action
          active={activeWallet === 'Keplr'}
          onClick={() => {
            try {
              setActiveWallet('Keplr');
              setActive(true);
            } catch (error) {
              console.error('Keplr connection error:', error);
              alert('Error, Check your Keplr Wallet');
            }
          }}
        >
          <img src={Keplr} style={{ width: '25px', marginRight: '10px' }} alt="Keplr logo" />
          <b>Connect to Keplr</b>
        </ListGroup.Item>
      </ListGroup>
      <hr />
      <div>
        {activeWallet === 'Keplr' ? (
          <>
            <KeplrConnect
              active={active}
              account={account}
              setAccount={setAccount}
              walletRpcProvider={walletRpcProvider}
              setWalletRpcProvider={setWalletRpcProvider}
              setKeplr={setKeplr}
              client={client}
              setActive={setActive}
              setProviderNetwork={setProviderNetwork}
            />
            <Project
              providerInstance={keplr}
              wallet={'Keplr'}
              account={account}
              client={client}
              providerNetwork={providerNetwork}
            />
          </>
        ) : (
          false
        )}
      </div>
    </div>
  );
};
