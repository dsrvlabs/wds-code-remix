import {
  IndexerGrpcAccountPortfolioApi,
  TxResponse,
  getInjectiveAddress,
} from '@injectivelabs/sdk-ts';
import { UtilsWallets } from '@injectivelabs/wallet-ts/dist/esm/exports';
import { MsgBroadcaster, Wallet, WalletStrategy } from '@injectivelabs/wallet-ts';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { ErrorType, WalletException, UnspecifiedErrorCode } from '@injectivelabs/exceptions';
import { log } from '../../utils/logger';
import { ethers } from 'ethers';

type WalletStoreState = {
  chainId: ChainId | string;
  setChainId: React.Dispatch<React.SetStateAction<ChainId | string>>;
  inEVMChainID: string;
  setInEVMChainID: React.Dispatch<React.SetStateAction<string>>;
  balance: string;
  inEVMBalance: string;
  setInEVMBalance: React.Dispatch<React.SetStateAction<string>>;
  walletType: Wallet | null;
  injectiveAddress: string;
  ethAddress: string;
  walletStrategy: WalletStrategy | null;
  msgBroadcastClient: MsgBroadcaster | null;
  changeWallet: (wallet: Wallet) => void;
  getAddresses: () => Promise<string[] | undefined>;
  injectiveBroadcastMsg: (msg: any, address?: string) => Promise<TxResponse | undefined>;
  init: (wallet: Wallet) => Promise<void>;
  isInEVM: boolean;
  setIsInEVM: React.Dispatch<React.SetStateAction<boolean>>;
};

const WalletContext = createContext<WalletStoreState>({
  chainId: ChainId.Mainnet,
  setChainId: () => {},
  inEVMChainID: '2525',
  setInEVMChainID: () => {},
  balance: '0',
  inEVMBalance: '0',
  setInEVMBalance: () => {},
  walletType: null,
  injectiveAddress: '',
  ethAddress: '',
  walletStrategy: null,
  msgBroadcastClient: null,
  changeWallet: async (wallet: Wallet) => {},
  getAddresses: async () => undefined,
  injectiveBroadcastMsg: async (msg: any, address?: string) => undefined,
  init: async (wallet: Wallet) => {},
  isInEVM: false,
  setIsInEVM: () => {},
});

export const useWalletStore = () => useContext(WalletContext);

type Props = {
  children?: React.ReactNode;
};

const WalletContextProvider = (props: Props) => {
  const [chainId, setChainId] = useState<ChainId | string>(ChainId.Testnet);
  const [inEVMChainID, setInEVMChainID] = useState('2525');
  const [walletType, setWalletType] = useState<Wallet | null>(null);
  const [injectiveAddress, setInjectiveAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [enabledWalletStrategy, setEnabledWalletStrategy] = useState<WalletStrategy | null>(null);
  const [msgBroadcastClient, setMsgBroadcastClient] = useState<MsgBroadcaster | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isInEVM, setIsInEVM] = useState(false);
  const [inEVMBalance, setInEVMBalance] = useState('0');

  const init = async (wallet: Wallet) => {
    const walletStrategy = new WalletStrategy({
      chainId: chainId as ChainId,
      ethereumOptions: {
        ethereumChainId:
          chainId === ChainId.Mainnet ? EthereumChainId.Mainnet : EthereumChainId.Sepolia,
      },
      wallet: wallet,
    });

    const addresses = await walletStrategy.enableAndGetAddresses();
    const currentWallet = walletStrategy.getWallet();

    if (addresses.length === 0) {
      throw new WalletException(new Error('There are no addresses linked in this wallet'), {
        code: UnspecifiedErrorCode,
        type: ErrorType.WalletError,
      });
    } else if (currentWallet === Wallet.Keplr) {
      setInjectiveAddress(addresses[0]);
      setWalletType(currentWallet);
      const endpoints = getNetworkEndpoints(
        chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
      );
      const msgBroadcastClient = new MsgBroadcaster({
        walletStrategy: walletStrategy,
        network: chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
        endpoints: endpoints,
        simulateTx: true,
      });

      setEnabledWalletStrategy(walletStrategy);
      setMsgBroadcastClient(msgBroadcastClient);
    } else if (currentWallet === Wallet.Metamask) {
      const convertedEthAddress = getInjectiveAddress(addresses[0]);
      setInjectiveAddress(convertedEthAddress);
      setEthAddress(addresses[0]);
      setWalletType(currentWallet);
      const endpoints = getNetworkEndpoints(
        chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
      );
      const msgBroadcastClient = new MsgBroadcaster({
        walletStrategy: walletStrategy,
        network: chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
        endpoints: endpoints,
        simulateTx: true,
        ethereumChainId:
          chainId === ChainId.Mainnet ? EthereumChainId.Mainnet : EthereumChainId.Sepolia,
      });

      setEnabledWalletStrategy(walletStrategy);
      setMsgBroadcastClient(msgBroadcastClient);
    } else {
      log.debug('No Wallet Selected');
    }
  };

  useMemo(async () => {
    switch (chainId) {
      case '2525': {
        const mainnetBalance = await new ethers.JsonRpcProvider(
          'https://mainnet.rpc.inevm.com/http',
        ).getBalance(ethAddress);
        setInEVMBalance(BigInt(mainnetBalance).toString());
        break;
      }
      case '2424': {
        const testnetBalance = await new ethers.JsonRpcProvider(
          'https://testnet.rpc.inevm.com/http',
        ).getBalance(ethAddress);
        setInEVMBalance(BigInt(testnetBalance).toString());
        break;
      }
    }
  }, [chainId]);

  useEffect(() => {
    if (isInEVM) {
    } else {
      if (chainId === '2525' || chainId === '2424') {
        setIsInEVM(true);
      } else {
        setIsInEVM(false);
      }
      if (injectiveAddress !== '') getBalance();
    }
  }, [chainId, injectiveAddress, walletType]);

  const changeWallet = async (wallet: Wallet) => {
    enabledWalletStrategy?.setWallet(wallet);
    await enabledWalletStrategy?.enable();
    setWalletType(wallet);
  };

  const getAddresses = async () => {
    const addresses = await enabledWalletStrategy?.getAddresses();
    return addresses;
  };

  const formatDecimal = (value: number, decimalPlaces = 18) => {
    const num = value / Math.pow(10, decimalPlaces);
    return num.toFixed(3);
  };

  //TODO: useMemo Maybe
  const getBalance = async () => {
    switch (chainId) {
      case ChainId.Mainnet: {
        const endpoints = getNetworkEndpoints(Network.Mainnet);
        const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(
          endpoints.indexer,
        );
        const portfolio = await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(
          injectiveAddress,
        );
        const injectiveBalance = portfolio.bankBalancesList.find(
          (balance) => balance.denom === 'inj',
        );

        if (injectiveBalance !== undefined) {
          const formattedBalance = formatDecimal(Number(injectiveBalance?.amount));
          setBalance(formattedBalance);
        } else {
          setBalance('0');
        }

        break;
      }
      case ChainId.Testnet: {
        const endpoints = getNetworkEndpoints(Network.Testnet);
        const indexerGrpcAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(
          endpoints.indexer,
        );
        const portfolio = await indexerGrpcAccountPortfolioApi.fetchAccountPortfolioBalances(
          injectiveAddress,
        );
        const injectiveBalance = portfolio.bankBalancesList.find(
          (balance) => balance.denom === 'inj',
        );

        if (injectiveBalance !== undefined) {
          const formattedBalance = formatDecimal(Number(injectiveBalance?.amount));
          setBalance(formattedBalance);
        } else {
          setBalance('');
        }

        break;
      }
      default: {
      }
    }
  };

  const injectiveBroadcastMsg = async (msg: any, address?: string) => {
    try {
      //TODO Refactor this code (works but looks weird)
      if (address) {
        if (walletType === Wallet.Metamask) {
          chainId === ChainId.Mainnet
            ? await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [
                  {
                    chainId: '0x0',
                  },
                ],
              })
            : await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [
                  {
                    chainId: '0xaa36a7',
                  },
                ],
              });
          const result = await msgBroadcastClient?.broadcastV2({
            injectiveAddress: address,
            msgs: msg,
          });
          return result;
        }
        const result = await msgBroadcastClient?.broadcastV2({
          injectiveAddress: address,
          msgs: msg,
        });
        return result;
      } else {
        const result = await msgBroadcastClient?.broadcastV2({
          msgs: msg,
        });
        return result;
      }
    } catch (e: any) {
      return e.message;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        chainId,
        setChainId,
        inEVMChainID,
        setInEVMChainID,
        balance,
        inEVMBalance,
        setInEVMBalance,
        walletType,
        injectiveAddress,
        ethAddress,
        walletStrategy: enabledWalletStrategy,
        msgBroadcastClient,
        changeWallet,
        getAddresses,
        injectiveBroadcastMsg,
        init,
        isInEVM,
        setIsInEVM,
      }}
    >
      {props.children}
    </WalletContext.Provider>
  );
};

export default WalletContextProvider;
