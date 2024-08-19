import { IndexerGrpcAccountPortfolioApi, TxResponse } from '@injectivelabs/sdk-ts';
import { MsgBroadcaster, Wallet, WalletStrategy } from '@injectivelabs/wallet-ts';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { ErrorType, WalletException, UnspecifiedErrorCode } from '@injectivelabs/exceptions';

type WalletStoreState = {
  chainId: ChainId;
  setChainId: React.Dispatch<React.SetStateAction<ChainId>>;
  balance: string;
  walletType: Wallet | null;
  walletAccount: string;
  walletStrategy: WalletStrategy | null;
  msgBroadcastClient: MsgBroadcaster | null;
  changeWallet: (wallet: Wallet) => void;
  getAddresses: () => Promise<string[] | undefined>;
  injectiveBroadcastMsg: (msg: any, address?: string) => Promise<TxResponse | undefined>;
};

const WalletContext = createContext<WalletStoreState>({
  chainId: ChainId.Mainnet,
  setChainId: () => {},
  balance: '0',
  walletType: null,
  walletAccount: '',
  walletStrategy: null,
  msgBroadcastClient: null,
  changeWallet: async (wallet: Wallet) => {},
  getAddresses: async () => undefined,
  injectiveBroadcastMsg: async (msg: any, address?: string) => undefined,
});

export const useWalletStore = () => useContext(WalletContext);

type Props = {
  children?: React.ReactNode;
};

const WalletContextProvider = (props: Props) => {
  const [chainId, setChainId] = useState(ChainId.Testnet);
  const [walletType, setWalletType] = useState<Wallet | null>(Wallet.Keplr);
  const [account, setAccount] = useState('');
  const [enabledWalletStrategy, setEnabledWalletStrategy] = useState<WalletStrategy | null>(null);
  const [msgBroadcastClient, setMsgBroadcastClient] = useState<MsgBroadcaster | null>(null);
  const [balance, setBalance] = useState<string>('0');

  const init = async () => {
    const walletStrategy = new WalletStrategy({
      chainId,
      wallet: Wallet.Keplr,
    });

    const addresses = await walletStrategy.enableAndGetAddresses();

    if (addresses.length === 0) {
      throw new WalletException(new Error('There are no addresses linked in this wallet'), {
        code: UnspecifiedErrorCode,
        type: ErrorType.WalletError,
      });
    } else {
      setAccount(addresses[0]);
    }
    const currentWallet = walletStrategy.getWallet();
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
  };

  useEffect(() => {
    init();
  }, [chainId]);

  useEffect(() => {
    if (account !== '') getBalance();
  }, [chainId, account]);

  const changeWallet = async (wallet: Wallet) => {
    enabledWalletStrategy?.setWallet(wallet);
    await enabledWalletStrategy?.enable();
    const addresses = await getAddresses();
    setAccount(addresses![0]);
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
          account,
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
          account,
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
        const result = await msgBroadcastClient?.broadcast({
          injectiveAddress: address,
          msgs: msg,
        });
        return result;
      } else {
        const result = await msgBroadcastClient?.broadcast({
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
        walletAccount: account,
        walletStrategy: enabledWalletStrategy,
        msgBroadcastClient,
        changeWallet,
        getAddresses,
        injectiveBroadcastMsg,
      }}
    >
      {props.children}
    </WalletContext.Provider>
  );
};

export default WalletContextProvider;