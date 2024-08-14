import { TxResponse } from '@injectivelabs/sdk-ts';
import { MsgBroadcaster, Wallet, WalletStrategy } from '@injectivelabs/wallet-ts';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types';
import { Network } from '@injectivelabs/networks';

type WalletStoreState = {
  chainId: ChainId;
  setChainId: React.Dispatch<React.SetStateAction<ChainId>>;
  walletType: Wallet | '';
  walletAccount: string;
  walletStrategy: WalletStrategy | undefined;
  msgBroadcastClient: MsgBroadcaster | undefined;
  changeWallet: (wallet: Wallet) => void;
  getAddresses: () => Promise<string[] | undefined>;
  injectiveBroadcastMsg: (msg: any, address: string) => Promise<TxResponse | undefined>;
};

const WalletContext = createContext<WalletStoreState>({
  chainId: ChainId.Mainnet,
  setChainId: () => {},
  walletType: '',
  walletAccount: '',
  walletStrategy: undefined,
  msgBroadcastClient: undefined,
  changeWallet: async (wallet: Wallet) => {},
  getAddresses: async () => undefined,
  injectiveBroadcastMsg: async (msg: any, address: string) => undefined,
});

export const useWalletStore = () => useContext(WalletContext);

type Props = {
  children?: React.ReactNode;
};

const WalletContextProvider = (props: Props) => {
  const [chainId, setChainId] = useState(ChainId.Mainnet);
  const [walletType, setWalletType] = useState<Wallet | ''>('');
  const [account, setAccount] = useState('');
  const [enabledWalletStrategy, setEnabledWalletStrategy] = useState<WalletStrategy>();
  const [msgBroadcastClient, setMsgBroadcastClient] = useState<MsgBroadcaster>();

  const init = async () => {
    const walletStrategy = new WalletStrategy({
      chainId,
      options:{
        
      }
      ethereumOptions: {
        ethereumChainId: EthereumChainId.Goerli,
      },
    });

    await walletStrategy.enable();

    const currentWallet = walletStrategy.getWallet();
    setWalletType(currentWallet);

    const addresses = await getAddresses();

    if (addresses?.length !== 0 && addresses === undefined) {
      console.log('no address');
    } else {
      setAccount(addresses![0]);
    }
    const msgBroadcastClient = new MsgBroadcaster({
      walletStrategy: walletStrategy,
      network: chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    });

    setEnabledWalletStrategy(walletStrategy);
    setMsgBroadcastClient(msgBroadcastClient);
  };

  useEffect(() => {
    init();
  }, [chainId]);

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

  const injectiveBroadcastMsg = async (msg: any, address: string) => {
    const result = await msgBroadcastClient?.broadcast({
      injectiveAddress: address,
      msgs: msg,
    });
    return result;
  };

  return (
    <WalletContext.Provider
      value={{
        chainId,
        setChainId,
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
