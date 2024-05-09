import { useState } from 'react';
import { WelldoneConnect } from './WelldoneConnect';
import { KeplrConnect } from './KeplrConnect';
import { Project } from './Project';
import { ListGroup } from 'react-bootstrap';

import Welldone from '../../assets/dsrv_wallet_icon.png';
import Keplr from '../../assets/Keplr-Big.svg';

interface InterfaceProps {
	client: any
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [dapp, setDapp] = useState<any>();
  const [keplr, setKeplr] = useState<any>();
  const [wallet, setWallet] = useState('');
  const [account, setAccount] = useState('');
  const [walletRpcProvider, setWalletRpcProvider] = useState<any>();
  const [activeWallet, setActiveWallet] = useState('');
  const [active, setActive] = useState(false);
  const [providerNetwork, setProviderNetwork] = useState<string>('neutron-1');

  return (
    <div>
      <ListGroup>
        <ListGroup.Item
          as="li"
          action
          active={activeWallet === 'Welldone'}
          onClick={() => {
            try {
              setActiveWallet('Welldone');
              setActive(true);
            } catch (error) {
              console.error('WELLDONE Connection error', error);
              alert('Error, Check your WELLDONE Wallet');
            }
          }}
        >
          <img
            src={Welldone}
            style={{ width: '25px', marginRight: '10px' }}
            alt="WELLDONE logo"
          />
          <b>Connect to WELLDONE</b>
        </ListGroup.Item>
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
          <img
            src={Keplr}
            style={{ width: '25px', marginRight: '10px' }}
            alt="Keplr logo"
          />
          <b>Connect to Keplr</b>
        </ListGroup.Item>
      </ListGroup>
      <hr />
      <div>
        {activeWallet === 'Welldone' ? (
          <>
            <WelldoneConnect
              active={active}
              account={account}
              setAccount={setAccount}
              walletRpcProvider={walletRpcProvider}
              setWalletRpcProvider={setWalletRpcProvider}
              setDapp={setDapp}
              client={client}
              setActive={setActive}
            />
            <Project
              providerInstance={dapp}
              wallet={'Welldone'}
              account={account}
              client={client}
              providerNetwork={providerNetwork}
            />
          </>
        ) : (
          false
        )}
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
