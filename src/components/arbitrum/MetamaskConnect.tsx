import React, { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { NetworkUI } from '../common/Network';
import Web3 from 'web3';
import { ARBITRUM_SEPOLIA_CHAIN } from './const';

const web3 = new Web3((window as any).ethereum);

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setInjectedProvider: Function;
  setProviderNetwork: Function;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Function;
}

export const MetamaskConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setInjectedProvider,
  setProviderNetwork,
  setActive,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('');

  const ethereum = (window as any).ethereum;
  let networkName = '';
  if (network === ARBITRUM_SEPOLIA_CHAIN.chainId) {
    networkName = ARBITRUM_SEPOLIA_CHAIN.chainName;
  }
  // Establish a connection to the Aptos blockchain on component mount
  useEffect(() => {
    const connect = async () => {
      if (!ethereum) {
        setError('Please install MetaMask.');
        return;
      }
      // if (active) {
      try {
        ethereum.on('chainChanged', (_chainId: string) => {
          window.location.reload();
        });
        ethereum.on('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            setAccount('');
            setBalance('');
            setActive(false);
          } else {
            setAccount(accounts[0]);
            fetchBalance(accounts[0]);
          }
        });
        const chainId = await ethereum.request({ method: 'eth_chainId' });
        console.log('chainId', chainId);
        setNetwork(chainId);
        setInjectedProvider(ethereum);
        setProviderNetwork(chainId);
        if (active) {
          const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          setAccount(accounts[0]);
          fetchBalance(accounts[0]);
        }
      } catch (error: any) {
        setError(error.message);
        log.error(error);
        await client.terminal.log({ type: 'error', value: error.message });
      }
      // }
    };

    const fetchBalance = async (account: string) => {
      const balance = await ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest'],
      });
      const formattedBalance = web3.utils.fromWei(balance, 'ether');
      setBalance(parseFloat(formattedBalance).toFixed(4));
    };

    connect();
  }, [active, ethereum, network]);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      {network === ARBITRUM_SEPOLIA_CHAIN.chainId ? (
        <NetworkUI networkName={networkName} />
      ) : (
        <small style={{ color: 'red', fontWeight: 'bold' }}>
          {ARBITRUM_SEPOLIA_CHAIN.chainName} network is supported currently.
          <br />
          Please switch to the network below and reconnect your wallet.
          <br />
          Chain ID: 421614
          <br />
          RPC URL: https://sepolia-rollup.arbitrum.io/rpc
        </small>
      )}
      {network === ARBITRUM_SEPOLIA_CHAIN.chainId ? (
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
      ) : null}
    </div>
  );
};

const mb4 = {
  marginBottom: '4px',
};
