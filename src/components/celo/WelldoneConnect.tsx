import { useState, useEffect } from 'react';
import { Project } from './Project';
import Web3 from 'web3';
import { getConfig } from './config';
import { Alert } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';

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
  const [web3, setWeb3] = useState<Web3>();

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
              .request('celo', {
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
                    method: 'celo',
                  });
                }
                dappProvider
                  .request('celo', {
                    method: 'dapp:getBalance',
                    params: [account['celo'].address],
                  })
                  .then((balance: any) => {
                    setAccount(account['celo'].address);
                    const bal = Web3.utils.fromWei(balance);
                    setBalance(bal.substring(0, bal.indexOf('.') + 3));
                    setDapp(dappProvider);
                  });
              })
              .catch(async (e: any) => {
                setAccount('');
                setBalance('');
                setActive(false);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
                await client.terminal.log({
                  type: 'error',
                  value: 'Please Unlock your WELLDONE Wallet OR Create Account',
                });
                setError('Unlock your WELLDONE Wallet OR Create Account');
              });
            const chainId = await dappProvider.request('celo', {
              method: 'eth_chainId',
              params: [],
            });
            setWeb3(new Web3(getConfig(chainId).forno));
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
      <Project dapp={dapp} account={account} balance={balance} client={client} web3={web3} />
    </div>
  );
};
