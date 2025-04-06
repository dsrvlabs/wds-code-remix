import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { NetworkUI } from '../common/Network';
import Web3 from 'web3';
import {
  MOVEMENT_MAINNET_CHAIN,
  MOVEMENT_TESTNET_CHAIN,
  MOVEMENT_NETWORKS,
  MOVEMENT_CURRENCY,
} from './const';

const web3 = new Web3((window as any).ethereum);

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setDapp: Function;
  client: Client<Api, Readonly<IRemixApi>>;
  setActive: Function;
}

interface INetworkInfo {
  chainName: string;
  value: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export const MetamaskConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setDapp,
  setActive,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<string>('');

  const networks: INetworkInfo[] = useMemo(
    () => [
      {
        chainName: MOVEMENT_MAINNET_CHAIN.chainName,
        value: MOVEMENT_MAINNET_CHAIN.chainId,
        rpcUrls: [MOVEMENT_NETWORKS.MAINNET.rpcUrls[0]],
        blockExplorerUrls: [MOVEMENT_NETWORKS.MAINNET.blockExplorerUrls[0]],
      },
      {
        chainName: MOVEMENT_TESTNET_CHAIN.chainName,
        value: MOVEMENT_TESTNET_CHAIN.chainId,
        rpcUrls: [MOVEMENT_NETWORKS.TESTNET.rpcUrls[0]],
        blockExplorerUrls: [MOVEMENT_NETWORKS.TESTNET.blockExplorerUrls[0]],
      },
    ],
    [],
  );

  const [network, setNetwork] = useState<INetworkInfo | null>(networks[0]);

  const ethereum = (window as any).ethereum;

  const getAccount = async () => {
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      return accounts[0];
    } catch (error) {
      setError('Failed to fetch accounts');
      return null;
    }
  };

  const getChainId = async () => {
    try {
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      return chainId;
    } catch (error) {
      setError('Failed to fetch chainId');
      return null;
    }
  };

  const getBalances = async (userAccount: string): Promise<string> => {
    try {
      const balance = await ethereum.request({
        method: 'eth_getBalance',
        params: [userAccount, 'latest'],
      });
      const formattedBalance = web3.utils.fromWei(balance, 'ether');
      return parseFloat(formattedBalance).toFixed(4);
    } catch (error) {
      setError('Failed to fetch balance');
      return '0';
    }
  };

  const setInfo = async (currentAccount: string, targetNetwork: INetworkInfo) => {
    const balance = await getBalances(currentAccount);
    setDapp(ethereum);
    setNetwork(targetNetwork);
    setBalance(balance);
    setActive(true);
  };

  const handleNetwork = (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetNetwork = networks.find((net) => net.value === event.target.value);
    if (!targetNetwork) return;
    setActive(false);
    setNetwork(targetNetwork);
    setBalance('');
  };

  const switchNetwork = async (chainId: string = MOVEMENT_MAINNET_CHAIN.chainId) => {
    const targetNetwork = networks.find((net) => net.value === chainId);
    console.log('targetNetwork', targetNetwork);
    if (!targetNetwork) return null;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });

      return targetNetwork;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const err = error as { code: number };
        if (err.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetNetwork.value,
                chainName: targetNetwork.chainName,
                rpcUrls: targetNetwork.rpcUrls,
                blockExplorerUrls: targetNetwork.blockExplorerUrls,
                nativeCurrency: MOVEMENT_CURRENCY,
              },
            ],
          });
          return targetNetwork;
        }
      }
      return null;
    }
  };

  useEffect(() => {
    const activateMetamask = async () => {
      if (!network) return null;
      const currentChainId = await getChainId();
      if (currentChainId !== network.value) await switchNetwork(network.value);
      else {
        const currentAccount = await getAccount();
        setAccount(currentAccount);
        setInfo(currentAccount, network);
      }
    };
    if (active) activateMetamask();
  }, [active, network]);

  useEffect(() => {
    const init = async () => {
      try {
        const chainId = await getChainId();
        const targetNetwork = networks.find((net) => net.value === chainId);
        if (!targetNetwork) await switchNetwork();
        else {
          const currentAccount = await getAccount();
          setAccount(currentAccount);
          setInfo(currentAccount, targetNetwork);
        }
      } catch (error) {
        log.error('Failed to initialize MetamaskConnect', error);
      }
    };

    init();

    if (!ethereum) return;
    ethereum.on('chainChanged', async (_chainId: string) => {
      try {
        const targetNetwork = networks.find((net) => net.value === _chainId);
        if (!targetNetwork) window.location.reload();
        else {
          const currentAccount = await getAccount();
          setAccount(currentAccount);
          setInfo(currentAccount, targetNetwork);
        }
      } catch (error) {
        log.error('Failed to execute change chain logic', error);
      }
    });

    ethereum.on('accountsChanged', async (accounts: string[]) => {
      try {
        if (accounts.length === 0) {
          setAccount('');
          setBalance('');
        } else {
          const currentAccount = await getAccount();
          setAccount(currentAccount);
          if (network) setInfo(currentAccount, network);
          else init();
        }
      } catch (error) {
        log.error('Failed to execute change account logic', error);
      }
    });

    return () => {
      ethereum.removeAllListeners('chainChanged');
      ethereum.removeAllListeners('accountsChanged');
    };
  }, []);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      {!network ? (
        <NetworkInfo />
      ) : (
        <React.Fragment>
          <Form>
            <Form.Group>
              <Form.Label>Network</Form.Label>
              <Form.Control as="select" value={network.value} onChange={handleNetwork} size="sm">
                {networks.map((network, idx) => (
                  <option key={idx} value={network.value}>
                    {network.chainName}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
            <Form.Group>
              <Form.Text className="text-muted" style={{ marginBottom: '4px' }}>
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
              <Form.Text className="text-muted" style={{ marginBottom: '4px' }}>
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
        </React.Fragment>
      )}
    </div>
  );
};

const NetworkInfo = () => (
  <small style={{ color: 'red', fontWeight: 'bold' }}>
    {MOVEMENT_MAINNET_CHAIN.chainName} and {MOVEMENT_TESTNET_CHAIN.chainName} network is supported
    currently.
    <br />
    Please switch to the network below and reconnect your wallet.
    <br />
    <br />
    Movement Mainnet
    <br />
    Chain ID: {MOVEMENT_MAINNET_CHAIN.chainId}
    <br />
    RPC URL: {MOVEMENT_NETWORKS.MAINNET.rpcUrls[0]}
    <br />
    <br />
    Movement Testnet
    <br />
    Chain ID: {MOVEMENT_TESTNET_CHAIN.chainId}
    <br />
    RPC URL: {MOVEMENT_NETWORKS.TESTNET.rpcUrls[0]}
    <br />
  </small>
);
