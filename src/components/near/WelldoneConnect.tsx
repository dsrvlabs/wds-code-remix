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
  setAccountID: Dispatch<React.SetStateAction<string>>;
  accountID: string;
  setWalletRpcProvider: Dispatch<React.SetStateAction<providers.WalletRpcProvider | undefined>>;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Dispatch<React.SetStateAction<boolean>>;
  setNearConfig: Dispatch<React.SetStateAction<Near | undefined>>;
  setProviderProxy: Dispatch<React.SetStateAction<Provider | undefined>>;
}

export const WelldoneConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  accountID,
  setAccountID,
  setWalletRpcProvider,
  setActive,
  setNearConfig,
  setProviderProxy,
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');

  const proxyProvider = new Provider();
  console.log('@@@', window);

  // Establish a connection to the NEAR blockchain on component mount
  useEffect(() => {
    if (active) {
      try {
        console.log(`@@@ window`, window);
        console.log(`@@@ proxyProvider`, proxyProvider);
        const network = proxyProvider.getNetwork();

        connect(getConfig(network) as any).then(async (near: Near) => {
          setNearConfig(near);

          setProviderProxy(proxyProvider);

          const walletRpcProvider = new providers.WalletRpcProvider(proxyProvider);

          setWalletRpcProvider(walletRpcProvider);

          walletRpcProvider.on('dapp:chainChanged', (provider: any) => {
            window.location.reload();
          });

          walletRpcProvider.on('dapp:accountsChanged', (provider: any) => {
            window.location.reload();
          });

          const account = proxyProvider.getAddress().address;

          if (account) {
            gtag('event', 'login', {
              method: 'near',
            });
          }

          proxyProvider.getBalance(account).then((balance: any) => {
            setAccountID(account);
            const bal = utils.format.formatNearAmount(balance);
            setBalance(bal.substring(0, bal.indexOf('.') + 3));
          });
        });
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
              value={accountID ? accountID + ' (' + balance + ' near)' : ''}
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
