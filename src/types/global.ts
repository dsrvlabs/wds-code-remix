import { AptosWallet } from '@aptos-labs/wallet-standard';

// IOTA 지갑 인터페이스 정의 (공식 문서 기반)
export interface AppMetadata {
  name: string;
  url?: string;
  description?: string;
  icon?: string;
  additionalInfo?: string;
}

export interface ConnectionOptions {
  disableModal?: boolean;
  initOnConnect?: boolean;
  disableEagerConnect?: boolean;
}

export interface IotaWallet {
  connect: () => Promise<void>;
  getAccount: () => Promise<{
    address: string;
    publicKey?: string;
    [key: string]: any;
  }>;
  disconnect: () => Promise<void>;
  signTransaction: () => Promise<any>;
  [key: string]: any;
}

export interface NightlyConnectIotaAdapter {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: () => Promise<any>;
  // 추가 메서드 및 속성
  [key: string]: any;

  build: (
    config: { appMetadata: AppMetadata; persistent?: boolean },
    connectionOptions?: ConnectionOptions,
    modalAnchor?: HTMLElement,
  ) => Promise<NightlyConnectIotaAdapter>;
}

export interface Nightly {
  aptos?: AptosWallet;
  iota?: IotaWallet;
  // [key: string]: any;
}

// Window 인터페이스 확장 방식 변경
declare global {
  interface Window {
    // 기존 nightly 타입 정의를 유지하면서 새 타입을 병합
    nightly?: { [key: string]: any; iota?: any; aptos?: any };
    dapp: any; // 다른 지갑도 나중에 인터페이스 정의 필요
    petra: any; // 다른 지갑도 나중에 인터페이스 정의 필요
  }
}
