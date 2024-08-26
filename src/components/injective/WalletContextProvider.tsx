import {
  IndexerGrpcAccountPortfolioApi,
  TxResponse,
  getInjectiveAddress,
} from '@injectivelabs/sdk-ts';
import { UtilsWallets } from '@injectivelabs/wallet-ts/dist/esm/exports';
import { MsgBroadcaster, Wallet, WalletStrategy } from '@injectivelabs/wallet-ts';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { ErrorType, WalletException, UnspecifiedErrorCode } from '@injectivelabs/exceptions';

type WalletStoreState = {
  chainId: ChainId;
  setChainId: React.Dispatch<React.SetStateAction<ChainId>>;
  balance: string;
  walletType: Wallet | null;
  injectiveAddress: string;
  ethAddress: string;
  walletStrategy: WalletStrategy | null;
  msgBroadcastClient: MsgBroadcaster | null;
  changeWallet: (wallet: Wallet) => void;
  getAddresses: () => Promise<string[] | undefined>;
  injectiveBroadcastMsg: (msg: any, address?: string) => Promise<TxResponse | undefined>;
  init: (wallet: Wallet) => Promise<void>;
};

const WalletContext = createContext<WalletStoreState>({
  chainId: ChainId.Mainnet,
  setChainId: () => {},
  balance: '0',
  walletType: null,
  injectiveAddress: '',
  ethAddress: '',
  walletStrategy: null,
  msgBroadcastClient: null,
  changeWallet: async (wallet: Wallet) => {},
  getAddresses: async () => undefined,
  injectiveBroadcastMsg: async (msg: any, address?: string) => undefined,
  init: async (wallet: Wallet) => {},
});

export const useWalletStore = () => useContext(WalletContext);

type Props = {
  children?: React.ReactNode;
};

const WalletContextProvider = (props: Props) => {
  const [chainId, setChainId] = useState(ChainId.Testnet);
  const [walletType, setWalletType] = useState<Wallet | null>(null);
  const [injectiveAddress, setInjectiveAddress] = useState('');
  const [ethAddress, setEthAddress] = useState('');
  const [enabledWalletStrategy, setEnabledWalletStrategy] = useState<WalletStrategy | null>(null);
  const [msgBroadcastClient, setMsgBroadcastClient] = useState<MsgBroadcaster | null>(null);
  const [balance, setBalance] = useState<string>('0');

  const init = async (wallet: Wallet) => {
    const walletStrategy = new WalletStrategy({
      chainId,
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
      console.log('No Wallet Selected');
    }
  };

  useEffect(() => {
    if (injectiveAddress !== '') getBalance();
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
    }
  };

  const injectiveBroadcastMsg = async (msg: any, address?: string) => {
    try {
      if (address) {
        if (walletType === Wallet.Metamask) {
          chainId === ChainId.Mainnet
            ? await UtilsWallets.updateMetamaskNetwork(EthereumChainId.Mainnet)
            : await UtilsWallets.updateMetamaskNetwork(EthereumChainId.Sepolia);
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
        balance,
        walletType,
        injectiveAddress,
        ethAddress,
        walletStrategy: enabledWalletStrategy,
        msgBroadcastClient,
        changeWallet,
        getAddresses,
        injectiveBroadcastMsg,
        init,
      }}
    >
      {props.children}
    </WalletContext.Provider>
  );
};

export default WalletContextProvider;
