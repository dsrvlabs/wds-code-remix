import { Dispatch, useState } from 'react';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { ListGroup, Alert } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import Welldone from '../../assets/dsrv_wallet_icon.png';
import Petra from '../../assets/petra.png';
import Keplr from '../../assets/Keplr-Big.svg';
import Metamask from '../../assets/MetaMask.png';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
  active: boolean;
  setActive: Dispatch<React.SetStateAction<boolean>>;
  chain: string;
  setWallet: Function;
  wallet: string;
}

const wallets = {
  welldone: {
    chains: ['aptos', 'neutron', 'sui', 'celo', 'klaytn', 'juno', 'near'], 
    image: Welldone,
    label: 'Connect to WELLDONE',
    checkInstalled: () => !!window.dapp,
    errorMsg: 'Please Install WELLDONE Wallet http://abit.ly/install-welldone-wallet . If you have installed it, please press the refresh button.',
  },
  petra: {
    chains: [''],
    image: Petra,
    label: 'Connect to Petra',
    checkInstalled: () => !!(window as any).aptos,
    errorMsg: 'Please Install Petra Wallet https://petra.app/ . If you have installed it, please press the refresh button.',
  },
  keplr: {
    chains: ['neutron'],
    image: Keplr,
    label: 'Connect to Neutron',
    checkInstalled: () => !!(window as any).keplr,
    errorMsg: 'Please Install Keplr Wallet https://www.keplr.app/ . If you have installed it, please press the refresh button.',
  },
  metamask: {
    chains: ['arbitrum'],
    image: Metamask,
    label: 'Connect to MetaMask',
    checkInstalled: () => !!(window as any).ethereum && (window as any).ethereum.isMetaMask,
    errorMsg: 'Please install MetaMask from https://metamask.io',
  },
};

export const Connect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  setActive,
  chain,
  setWallet,
  wallet,
}) => {
  const [error, setError] = useState<string>('');

  return (
    <ListGroup>
      {Object.entries(wallets).map(([key, walletInfo]) => {
        if (!walletInfo.chains.includes(chain) && !walletInfo.chains.includes('default')) {
          return null;
        }

        return (
          <ListGroup.Item
            as="li"
            key={key}
            style={{ cursor: 'pointer' }}
            action
            active={active && wallet === key}
            onClick={async () => {
              if (!walletInfo.checkInstalled()) {
                await client.terminal.log({
                  value: walletInfo.errorMsg,
                  type: 'error',
                });
                setError(walletInfo.errorMsg);
              } else {
                setActive(true);
                setWallet(key);
              }
            }}
          >
            <img src={walletInfo.image} style={{ width: '25px', marginRight: '10px' }} alt={`${walletInfo.label} logo`} />
            <b>{walletInfo.label}</b>
          </ListGroup.Item>
        );
      })}
      <Alert style={{ marginTop: '10px' }} variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
    </ListGroup>
  );
};
