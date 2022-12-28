import { useState, useEffect, Dispatch } from 'react';
import { Form, InputGroup, Alert } from 'react-bootstrap';
import { connect, Near, utils, providers } from 'near-api-js';
import { getConfig } from './utils/config';
import { Provider } from './WalletRpcProvider';
import AlertCloseButton from '../common/AlertCloseButton';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';

interface InterfaceProps {
  active: boolean;
  account: { address: string; pubKey: string };
  setAccount: Dispatch<React.SetStateAction<{ address: string; pubKey: string }>>;
  setWalletRpcProvider: Dispatch<React.SetStateAction<providers.WalletRpcProvider | undefined>>;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Dispatch<React.SetStateAction<boolean>>;
  setNearConfig: Dispatch<React.SetStateAction<Near | undefined>>;
  setProviderProxy: Dispatch<React.SetStateAction<Provider | undefined>>;
}

export const WelldoneConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setWalletRpcProvider,
  setActive,
  setNearConfig,
  setProviderProxy,
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');

  const proxyProvider = new Provider();

  // Establish a connection to the NEAR blockchain on component mount
  useEffect(() => {
    const welldoneConnect = async () => {
      if (active) {
        try {
          const account = await proxyProvider.getAccount();
          if (account.constructor === Object && Object.keys(account).length === 0) {
            setAccount({ address: '', pubKey: '' });
            setBalance('');
            setActive(false);
            throw new Error('No account');
          }
          if (account.address !== '') {
            gtag('event', 'login', {
              method: 'near',
            });
          }
          const network = await proxyProvider.getNetwork();
          const near = await connect(getConfig(network) as any);
          setNearConfig(near);

          const walletRpcProvider = new providers.WalletRpcProvider(proxyProvider); // dapp:accounts
          setProviderProxy(proxyProvider);
          setWalletRpcProvider(walletRpcProvider);

          walletRpcProvider.on('dapp:chainChanged', (provider: any) => {
            window.location.reload();
          });

          walletRpcProvider.on('dapp:accountsChanged', (provider: any) => {
            window.location.reload();
          });

          const balance = await proxyProvider.getBalance(account.address);
          const bal = utils.format.formatNearAmount(balance);
          setAccount(account);
          setBalance(bal.substring(0, bal.indexOf('.') + 3));
        } catch (e: any) {
          const error = async () => {
            await client.terminal.log({ type: 'error', value: e?.message?.toString() });
            await client.terminal.log({
              type: 'error',
              value: 'Please Unlock your WELLDONE Wallet OR Create Account',
            });
            setError('Unlock your WELLDONE Wallet OR Create Account');
            setActive(false);
          };
          log.error(e);
          error();
        }
      }
    };
    welldoneConnect();
  }, [active]);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form>
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>ACCOUNT</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Account"
              value={account.address !== '' ? account.address + ' (' + balance + ' near)' : ''}
              size="sm"
              readOnly
            />
          </InputGroup>
        </Form.Group>
      </Form>
    </div>
  );
};

const mb4 = {
  marginBottom: '4px',
};
