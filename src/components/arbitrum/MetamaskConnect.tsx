import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { NetworkUI } from '../common/Network';
import Web3 from 'web3';
import { ARBITRUM_ONE_CHAIN, ARBITRUM_SEPOLIA_CHAIN } from './const';

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

interface INetworkInfo {
  chainName: string;
  value: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

/**
 * 1.1. Arbitrum 버튼을 클릭하고 들어왔을 때, 현재 protocol 및 network가 arbitrum일 때 연결해주어야 함
 * 1.2. Arbitrum 버튼을 클릭하고 들어왔을 때, 현재 protocol 및 network가 arbitrum이지 않을 때 network를 추가 및 변경해주어야 함
 * 2.1. useEffect를 통해 유저가 인입됐을 때 connectMetamask를 실행
 * 2.2. connectMetamask에서 chainId를 요청하고 chainId를 받아온 후 switchNetwork를 실행
 * 2.2.1. switchNetwork에서 변경이 됐다면 ethereum.on에서 감지를 함
 * 2.2.2. switchNetwork에서 변경이 되지 않았다면 (현재 network = 지갑의 network) ethereum.on에서 감지를 하지 못함
 * 3.1. 신경써야 하는 변수는 다음과 같음
 * 3.1.1. active, account, injectiveProvider, providerNetwork: 부모 component로부터 내려온 전역 변수들임
 * 3.1.1.1. 그 중 active 및 account는 MetamaskConnect에서 사용
 * 3.2.2. balance, network는 MetamaskConnect의 지역 변수들임
 * 3.2.2.1. balance는 input form에
 * 3.2.2.2. network는 현재 선택된 network의 정보를 저장하는데 사용
 * 4.1. 유저가 input form의 network를 변경했을 때 handleNetwork를 통해 변수들을 설정해주어야 함
 * 5.1. 유저가 ethereum.on('chainChanged')에서 network를 변경했을 때, 변수들을 설정해주어야 함
 * 6.1. 유저가 ethereum.on('accountsChanged')에서 account를 변경했을 때, 변수들을 설정해주어야 함
 */
/**
 * 생각해야하는 경우의 수
 * 1. 유저가 처음 페이지에 들어왔을 때
 * 1.1. 유저가 처음 페이지에 들어왔는데 chain이 arbitrum일 때 (network가 arbitrum 종류일 때)
 *      유저의 account를 연결하여 account 및 balance, network를 가져와야 함
 * 1.2. 유저가 처음 페이지에 들어왔는데 chain이 arbitrum이 아닐 때 (network가 arbitrum 종류가 아닐 때)
 *      유저의 network를 arbitrum one으로 변경하여 account 및 balance, network를 가져와야 함
 * 2. 유저가 form을 통해 현재 선택된 network를 변경하고자 할 때
 *    유저가 form을 변경했다면 active 상태를 false로 만들어 버튼을 통해 network 변경 및 account 및 balance, network를 가져와야 함
 * 3. 유저가 metamask에서 chainId를 변경했을 때
 * 4. 유저가 metamask에서 account를 변경했을 때
 */

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
  const [error, setError] = useState<string>('');
  const [network, setNetwork] = useState<INetworkInfo | null>(null);

  const networks: INetworkInfo[] = useMemo(
    () => [
      {
        chainName: ARBITRUM_ONE_CHAIN.chainName,
        value: ARBITRUM_ONE_CHAIN.chainId,
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io/'],
      },
      {
        chainName: ARBITRUM_SEPOLIA_CHAIN.chainName,
        value: ARBITRUM_SEPOLIA_CHAIN.chainId,
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://sepolia-rollup-explorer.arbitrum.io/'],
      },
    ],
    [],
  );

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
    // general
    setInjectedProvider(ethereum);
    setProviderNetwork(targetNetwork.value);
    // local
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

  const switchNetwork = async (chainId: string = ARBITRUM_ONE_CHAIN.chainId) => {
    const targetNetwork = networks.find((net) => net.value === chainId);
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
                nativeCurrency: { name: 'Arbitrum', symbol: 'ETH', decimals: 18 },
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
      await switchNetwork(network.value);
    };
    if (active) activateMetamask();
  }, [active]);

  useEffect(() => {
    const init = async () => {
      const chainId = await getChainId();
      const targetNetwork = networks.find((net) => net.value === chainId);
      if (!targetNetwork) await switchNetwork();
      else {
        const currentAccount = await getAccount();
        setAccount(currentAccount);
        setInfo(currentAccount, targetNetwork);
      }
    };

    init();

    ethereum.on('chainChanged', async (_chainId: string) => {
      const targetNetwork = networks.find((net) => net.value === _chainId);
      if (!targetNetwork) window.location.reload();
      else {
        const currentAccount = await getAccount();
        setAccount(currentAccount);
        setInfo(currentAccount, targetNetwork);
      }
    });

    ethereum.on('accountsChanged', async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount('');
        setBalance('');
      } else {
        const currentAccount = await getAccount();
        setAccount(currentAccount);
        setBalance('');
        setActive(false);
      }
    });
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
          {/* <NetworkUI networkName={network.chainName} /> */}
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
        </React.Fragment>
      )}
    </div>
  );
};

const NetworkInfo = () => (
  <small style={{ color: 'red', fontWeight: 'bold' }}>
    {ARBITRUM_ONE_CHAIN.chainName} and {ARBITRUM_SEPOLIA_CHAIN.chainName} network is supported
    currently.
    <br />
    Please switch to the network below and reconnect your wallet.
    <br />
    <br />
    Arbitrum One
    <br />
    Chain ID: 42161
    <br />
    RPC URL: https://arb1.arbitrum.io/rpc
    <br />
    <br />
    Arbitrum Sepolia
    <br />
    Chain ID: 421614
    <br />
    RPC URL: https://sepolia-rollup.arbitrum.io/rpc
    <br />
  </small>
);

const mb4 = {
  marginBottom: '4px',
};
