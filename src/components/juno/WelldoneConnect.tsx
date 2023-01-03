import { useEffect, useState } from 'react';
import { Form, InputGroup } from 'react-bootstrap';

import { EncodeObject } from '@cosmjs/proto-signing';

import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';
import { StargateClient } from '@cosmjs/stargate';

interface MsgStoreCodeEncodeObject extends EncodeObject {
  readonly typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode';
  readonly value: Partial<MsgStoreCode>;
}

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
  const [wasm, setWasm] = useState<any>();

  const dappProvider = (window as any).dapp;

  useEffect(() => {
    if (active) {
      if (dappProvider) {
        log.debug(dappProvider);

        dappProvider.on('chainChanged', (provider: any) => {
          log.debug(provider);
          window.location.reload();
        });

        dappProvider.on('accountsChanged', (provider: any) => {
          log.debug(provider);
          window.location.reload();
        });

        dappProvider
          .request('juno', {
            method: 'dapp:accounts',
          })
          .then(async (account: { [x: string]: { address: any } }) => {
            log.debug(account);
            const address = account?.['juno'].address;

            if (!address) {
              setAccount('');
              setBalance('');
              setActive(false);
              return;
            }

            setAccount(address);

            const client = await StargateClient.connect('https://rpc.uni.junonetwork.io/');
            const balances = await client.getAllBalances(address);
            const balance = balances.find((balance) => balance.denom === 'ujunox');
            if (balance) {
              setBalance(`${balance.amount} ${balance.denom}`);
            }
          });
      } else {
        setAccount('');
        setBalance('');
        setActive(false);
      }
    }
  }, [active, dappProvider]);

  return (
    <div>
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
