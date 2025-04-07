import React from 'react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { createRoot } from 'react-dom/client';

interface OKXWallet {
  aptos: {
    connect(): Promise<{ address: string; publicKey: string }>;
    account(): Promise<{ address: string; publicKey: string }>;
    network(): Promise<string>;
    onAccountChange(
      callback: (account: { address: string; publicKey: string } | null) => void,
    ): void;
    onNetworkChange(callback: (network: string) => void): void;
    onDisconnect(callback: () => void): void;
  };
}

declare global {
  interface Window {
    dapp: any;
    petra: any;
    okxwallet?: OKXWallet;
  }
}

const root = createRoot(document.getElementById('root') as HTMLElement);

window.addEventListener('load', () => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
