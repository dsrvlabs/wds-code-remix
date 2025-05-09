import { AptosWallet } from '@aptos-labs/wallet-standard';

export interface Nightly {
  aptos?: AptosWallet;
}

// 전역 타입 확장
declare global {
  interface Window {
    nightly?: Nightly;
    dapp: any; // 다른 지갑도 나중에 인터페이스 정의 필요
    petra: any; // 다른 지갑도 나중에 인터페이스 정의 필요
  }
}
