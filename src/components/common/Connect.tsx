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
import OKX from '../../assets/okx.png';
import Nightly from '../../assets/nightly.png';
import { getAptosWallets } from '@aptos-labs/wallet-standard';

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
    errorMsg:
      'Please Install WELLDONE Wallet http://abit.ly/install-welldone-wallet . If you have installed it, please press the refresh button.',
  },
  nightly: {
    chains: ['movement'],
    image: Nightly,
    label: 'Connect to Nightly',
    checkInstalled: () => !!(window as any).nightly,
    errorMsg: (
      <>
        Please Install Nightly Wallet from{' '}
        <span
          style={{ cursor: 'pointer', color: '#0d6efd' }}
          onClick={(e) => {
            const target = e.currentTarget;
            const originalText = target.textContent;
            const tempInput = document.createElement('input');
            tempInput.value =
              'https://chromewebstore.google.com/detail/nightly/fiikommddbeccaoicoejoniammnalkfa';
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            target.textContent = 'Copied!';
            target.style.color = '#198754';

            setTimeout(() => {
              target.textContent = originalText;
              target.style.color = '#0d6efd';
            }, 2000);
          }}
        >
          Chrome Web Store.
        </span>
        <br />
        If you have installed it, please press the refresh button.
      </>
    ),
  },
  keplr: {
    chains: ['neutron'],
    image: Keplr,
    label: 'Connect to Neutron',
    checkInstalled: () => !!(window as any).keplr,
    errorMsg:
      'Please Install Keplr Wallet https://www.keplr.app/ . If you have installed it, please press the refresh button.',
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
  const [error, setError] = useState<string | JSX.Element>('');

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
                const terminalErrorMsg =
                  typeof walletInfo.errorMsg === 'string'
                    ? walletInfo.errorMsg
                    : `Please Install ${walletInfo.label}. If you have installed it, please press the refresh button.`;

                await client.terminal.log({
                  value: terminalErrorMsg,
                  type: 'error',
                });
                setError(walletInfo.errorMsg);
              } else {
                setActive(true);
                setWallet(key);
              }
            }}
          >
            <img
              src={walletInfo.image}
              style={{ width: '25px', marginRight: '10px' }}
              alt={`${walletInfo.label} logo`}
            />
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
