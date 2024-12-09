import { useState } from 'react';
import { KeplrConnect } from './KeplrConnect';
import { Project } from './Project';
import { ListGroup } from 'react-bootstrap';

import Keplr from '../../assets/Keplr-Big.svg';
import MetaMask from '../../assets/MetaMask.png';
import WalletContextProvider, { useWalletStore } from './WalletContextProvider';
import MetaMaskConnect from './MetaMaskConnect';

interface InterfaceProps {
  client: any;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [dapp, setDapp] = useState<any>();
  const [activeWallet, setActiveWallet] = useState('');
  const [active, setActive] = useState(false);
  return (
    <WalletContextProvider>
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
          <ListGroup.Item
            as="li"
            action
            active={activeWallet === 'MetaMask'}
            onClick={() => {
              try {
                setActiveWallet('MetaMask');
                setActive(true);
              } catch (error) {
                console.error('MetaMask connection error:', error);
                alert('Error, Check your MetaMask Wallet');
              }
            }}
          >
            <img src={MetaMask} style={{ width: '25px', marginRight: '10px' }} alt="Keplr logo" />
            <b>Connect to MetaMask</b>
          </ListGroup.Item>
        </ListGroup>
        <hr />
        <div>
          {activeWallet === 'Keplr' ? (
            <>
              <KeplrConnect />
              <Project client={client} />
            </>
          ) : activeWallet === 'MetaMask' ? (
            <>
              <MetaMaskConnect />
              <Project client={client} />
            </>
          ) : (
            false
          )}
        </div>
      </div>
    </WalletContextProvider>
  );
};
