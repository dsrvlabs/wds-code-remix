import { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setWalletRpcProvider: Function;
  walletRpcProvider: any;
  setDapp: Function;
  client: any;
  setActive: Function;
}

export const WelldoneConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  walletRpcProvider,
  setWalletRpcProvider,
  setDapp,
  setActive,
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');

  const dappProvider = (window as any).dapp;

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
          if (dappProvider) {
            dappProvider.on('dapp:chainChanged', (provider: any) => {
              window.location.reload();
            });

            dappProvider.on('dapp:accountsChanged', (provider: any) => {
              window.location.reload();
            });

            dappProvider
              .request('juno', {
                method: 'dapp:accounts',
              })
              .then((account: any) => {
                if (account.constructor === Object && Object.keys(account).length === 0) {
                  setAccount('');
                  setBalance('');
                  setActive(false);
                }

                if (account) {
                  gtag('event', 'login', {
                    method: 'juno',
                  });
                }
                dappProvider
                  .request('juno', {
                    method: 'dapp:getBalance',
                    params: [account['juno'].address],
                  })
                  .then((balance: any) => {
                    setAccount(account['juno'].address);
                    log.debug('bal: ', balance);
                    setBalance(balance ?? '');
                    setDapp(dappProvider);
                  })
                  .catch(async (e: any) => {
                    setAccount('');
                    setBalance('');
                    await client.terminal.log({ type: 'error', value: e?.message?.toString() });
                    await client.terminal.log({
                      type: 'error',
                      value: 'Please create account on chain',
                    });
                    setError('Create account on chain');
                    setActive(false);
                  })
              })
              .catch(async (e: any) => {
                setAccount('');
                setBalance('');
                await client.terminal.log({ type: 'error', value: e?.message?.toString() });
                await client.terminal.log({
                  type: 'error',
                  value: 'Please Unlock your WELLDONE Wallet OR Create Account',
                });
                setError('Unlock your WELLDONE Wallet OR Create Account');
                setActive(false);
              });
          } else {
            setAccount('');
            setBalance('');
            setActive(false);
          }
        } catch (e: any) {
          log.error(e);
          await client.terminal.log({ type: 'error', value: e?.message?.toString() });
        }
      }
    };
    connect();
  }, [active, dappProvider]);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form>
        <Form.Text className="text-muted" style={mb4}>
          <small>ACCOUNT</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Account"
            value={account ? account : ''}
            size="sm"
            readOnly
          />
        </InputGroup>
        <Form.Text className="text-muted" style={mb4}>
          <small>BALANCE</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Balance"
            value={account ? balance || '' : ''}
            size="sm"
            readOnly
          />
        </InputGroup>
      </Form>
    </div>
  );
};

const mb4 = {
  marginBottom: '4px',
};
