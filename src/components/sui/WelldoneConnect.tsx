import React, { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { CopyToClipboard } from '../common/CopyToClipboard';

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setDapp: Function;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Function;
}

export const WelldoneConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setDapp,
  setActive,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<String>('');

  const dappProvider = window.dapp;
  // const proxyProvider = new Provider();

  // Establish a connection to the Sui blockchain on component mount
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
              .request('sui', {
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
                    method: 'sui',
                  });
                }
                dappProvider
                  .request('sui', {
                    method: 'dapp:getBalance',
                    params: [account['sui'].address],
                  })
                  .then((balance: any) => {
                    setAccount(account['sui'].address);
                    log.debug('bal: ', balance);
                    setBalance(balance ?? '');
                    setDapp(dappProvider);
                  })
                  .catch(async (e: any) => {
                    log.error(e);
                    setAccount(
                      '0x458dc58dfdacefa2dfae5dc5aca8151ac438bbdefd0c89afe7d725189f7249bd',
                    );
                    setBalance('');

                    // todo sui
                    // await client.terminal.log({ type: 'error', value: e?.message?.toString() });
                    // await client.terminal.log({
                    //   type: 'error',
                    //   value: 'Please create account on chain',
                    // });
                    // setError('Create account on chain');
                    // setActive(false);

                    setActive(true);
                  });
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
    <div style={mt10}>
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
              value={account ? account : ''}
              size="sm"
              readOnly
            />
            <CopyToClipboard tip="Copy" content={account} direction="top-end" />
          </InputGroup>
          <Form.Text className="text-muted" style={mb4}>
            <small>BALANCE</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Balance"
              value={account ? balance : ''}
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
const mt10 = {
  marginTop: '10px',
};
