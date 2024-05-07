import { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { NetworkUI } from '../common/Network';
import { convertToRealChainId } from './neutron-helper';

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
  const [network, setNetwork] = useState<string>('');

  const dappProvider = (window as any).dapp;

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
            if (dappProvider) {
                dappProvider.on('dapp:chainChanged', () => window.location.reload());
                dappProvider.on('dapp:accountsChanged', () => window.location.reload());

                // Try to get chain ID while wallet is locked
                try {
                    const networkName = await dappProvider.request('neutron', { method: 'dapp:chainId' });
                    setNetwork(networkName);
                } catch (error) {
                    setError('The wallet is locked. Please unlock your wallet.');
                    setActive(false);
                    return;
                }

                // Try to retrieve account information while wallet is locked
                try {
                    const accountData = await dappProvider.request('neutron', { method: 'dapp:accounts' });
                    if (Object.keys(accountData).length === 0) {
                        setError('No account information found. Please unlock the wallet or create an account.');
                        setAccount('');
                        setBalance('');
                        setActive(false);
                        return;
                    } else {
                      gtag('event', 'login', {
                        event_category: 'authentication',
                        event_label: 'welldone_wallet_connection',
                        method: 'neutron',
                      });
                    }

                    const balance = await dappProvider.request('neutron', {
                        method: 'dapp:getBalance',
                        params: [accountData['neutron'].address],
                    });

                    setAccount(accountData['neutron'].address);
                    setBalance(balance ?? '');
                    setDapp(dappProvider);
                } catch (error) {
                    setError('Unable to retrieve account information. Please unlock your wallet.');
                    setAccount('');
                    setBalance('');
                    setActive(false);
                }
            } else {
                setError('Unable to find the WELLDONE Wallet.');
                setAccount('');
                setBalance('');
                setActive(false);
            }
        } catch (e: any) {
            log.error(e);
            setError('An unknown error occurred.');
            setActive(false);
        }
      }
    }
    connect();
  }, [active, dappProvider]);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      {network && dappProvider && dappProvider.networks && dappProvider.networks.neutron ? (
        <NetworkUI networkName={convertToRealChainId(dappProvider.networks.neutron.chain)} />
        ) : (
            <Alert variant="warning">
                <div>Unable to retrieve network information. Please ensure the wallet is unlocked and try again.</div>
            </Alert>
        )}
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
