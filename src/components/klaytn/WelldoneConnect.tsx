import { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { log } from '../../utils/logger';
import AlertCloseButton from '../common/AlertCloseButton';
import { Project } from './Project';

interface InterfaceProps {
  active: boolean;
  client: any;
  setActive: Function;
}

export const WelldoneConnect: React.FunctionComponent<InterfaceProps> = ({
  active,
  client,
  setActive,
}) => {
  const [dapp, setDapp] = useState<any>();
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<string>('');

  const dappProvider = window.dapp;
  // Establish a connection to the NEAR blockchain on component mount
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
              .request('klaytn', {
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
                    method: 'klaytn',
                  });
                }
                dappProvider
                  .request('klaytn', {
                    method: 'dapp:getBalance',
                    params: [account['klaytn'].address],
                  })
                  .then((balance: any) => {
                    setAccount(account['klaytn'].address);
                    setBalance(balance);
                    setDapp(dappProvider);
                  });
              })
              .catch(async (e: any) => {
                setAccount('');
                setBalance('');
                setActive(false);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
                await client?.terminal.log('Please Unlock your WELLDONE Wallet OR Create Account');
                setError('Unlock your WELLDONE Wallet OR Create Account');
              });
          } else {
            setAccount('');
            setBalance('');
            setActive(false);
          }
        } catch (e: any) {
          log.error(e);
          await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
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
      <Project dapp={dapp} account={account} balance={balance} client={client} />
    </div>
  );
};
