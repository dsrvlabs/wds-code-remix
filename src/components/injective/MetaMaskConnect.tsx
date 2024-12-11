import React, { useEffect, useMemo, useState } from 'react';
import { useWalletStore } from './WalletContextProvider';
import { ChainId } from '@injectivelabs/ts-types';
import { Wallet } from '@injectivelabs/wallet-ts';
import { Alert, Button, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { MsgSend } from '@injectivelabs/sdk-ts';
import { BigNumberInBase } from '@injectivelabs/utils';
import { log } from '../../utils/logger';
import { ethers } from 'ethers';

const MetaMaskConnect: React.FunctionComponent = () => {
  const [error, setError] = useState<String>('');
  const {
    chainId,
    setChainId,
    balance,
    injectiveAddress,
    init,
    injectiveBroadcastMsg,
    walletStrategy,
    isInEVM,
    inEVMBalance,
    ethAddress,
  } = useWalletStore();

  const networks = useMemo(
    () => [
      { name: 'Mainnet', value: ChainId.Mainnet },
      { name: 'Testnet', value: ChainId.Testnet },
      { name: 'inEVM Mainnet', value: '2525' },
      { name: 'inEVM Testnet', value: '2424' },
    ],
    [],
  );

  useEffect(() => {
    init(Wallet.Metamask);
  }, []);

  const handleNetwork = async (e: any) => {
    if (!window.ethereum) {
      log.error('Something is wrong with MetaMask');
      return;
    }
    //Check if it's inEVM
    if (e.target.value === '2525' || e.target.value === '2424') {
      setChainId(e.target.value);
      try {
        switch (e.target.value) {
          case '2525': {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x9DD' }],
            });
            break;
          }
          case '2424': {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x978' }],
            });
            break;
          }
        }
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          try {
            switch (e.target.value) {
              case '2525': {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: '0x9DD',
                      chainName: 'inEVM',
                      rpcUrls: ['https://mainnet.rpc.inevm.com/http'],
                      nativeCurrency: {
                        name: 'INJ',
                        symbol: 'INJ',
                        decimals: 18,
                      },
                    },
                  ],
                });
                break;
              }
              case '2424': {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [
                    {
                      chainId: '0x978',
                      chainName: 'inEVM testnet',
                      rpcUrls: ['https://testnet.rpc.inevm.com/http'],
                      nativeCurrency: {
                        name: 'INJ',
                        symbol: 'INJ',
                        decimals: 18,
                      },
                    },
                  ],
                });
                break;
              }
            }
          } catch (addError) {
            log.error(addError);
          }
        }
      }
    } else {
      setChainId(e.target.value);
    }
  };
  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group>
        <Form.Label>Network</Form.Label>
        <Form.Control as="select" value={chainId} onChange={handleNetwork} size="sm">
          {networks.map((net, idx) => (
            <option key={idx} value={net.value}>
              {net.name}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      <Form>
        <Form.Text className="text-muted" style={mb4}>
          <small>ACCOUNT</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Account"
            value={injectiveAddress ? (isInEVM ? ethAddress : injectiveAddress) : ''}
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
            value={injectiveAddress ? (isInEVM ? inEVMBalance : balance || '') : ''}
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

export default MetaMaskConnect;
