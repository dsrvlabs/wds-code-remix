import React, { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { CopyToClipboard } from '../common/CopyToClipboard';
import { NetworkUI } from '../common/Network';
import { AptosClient } from 'aptos';
import { FaSyncAlt } from 'react-icons/fa';

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setDapp: Function;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Function;
  wallet: string;
}

export const WalletConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setDapp,
  setActive,
  wallet,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('Movement Testnet');

  const networks = ['Movement Mainnet', 'Movement Testnet'];

  const fetchBalance = async (address: string) => {
    try {
      const rpcUrl =
        selectedNetwork === 'Movement Mainnet'
          ? 'https://bardock.movementnetwork.xyz/v1'
          : 'https://testnet.bardock.movementnetwork.xyz/v1';

      const client = new AptosClient(rpcUrl);
      const resources = await client.getAccountResources(address);
      const coinStore = resources.find(
        (r) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
      );

      if (coinStore) {
        const balance = (coinStore.data as any).coin.value;
        setBalance(balance);
      } else {
        setBalance('0');
      }
    } catch (e: any) {
      log.error(e);
      setBalance('0');
    }
  };

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
          if (!window.okxwallet?.aptos) {
            setError('OKX Wallet is not installed.');
            setActive(false);
            return;
          }

          // Connect wallet
          const response = await window.okxwallet.aptos.connect();
          setAccount(response.address);
          await fetchBalance(response.address);

          // Set network
          setNetwork(selectedNetwork);

          // Get account information
          const accountInfo = await window.okxwallet.aptos.account();

          // Register event listeners
          window.okxwallet.aptos.onAccountChange((newAccount) => {
            if (newAccount) {
              setAccount(newAccount.address);
              fetchBalance(newAccount.address);
            } else {
              setAccount('');
              setBalance('');
              setActive(false);
            }
          });

          window.okxwallet.aptos.onNetworkChange((newNetwork) => {
            setNetwork(selectedNetwork);
          });

          window.okxwallet.aptos.onDisconnect(() => {
            setAccount('');
            setBalance('');
            setActive(false);
          });

          // Set wallet instance for DApp
          setDapp(window.okxwallet.aptos);
        } catch (e: any) {
          log.error(e);
          if (e.code === 4001) {
            setError('Wallet connection was rejected.');
          } else {
            setError('An unknown error occurred.');
          }
          setActive(false);
        }
      }
    };
    connect();
  }, [active, selectedNetwork]);

  const handleNetworkChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newNetwork = event.target.value;
    setSelectedNetwork(newNetwork);
    if (account) {
      await fetchBalance(account);
    }
  };

  return (
    <div style={mt10}>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group style={mt8}>
        <Form.Text className="text-muted" style={mb4}>
          <small>NETWORK</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            className="custom-select"
            as="select"
            value={selectedNetwork}
            onChange={handleNetworkChange}
          >
            {networks.map((networkName, idx) => (
              <option value={networkName} key={idx}>
                {networkName}
              </option>
            ))}
          </Form.Control>
        </InputGroup>
      </Form.Group>
      <Form>
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Account</small>
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
            <small>Balance</small>
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
const mt8 = {
  marginTop: '8px',
};
const mt10 = {
  marginTop: '10px',
};
