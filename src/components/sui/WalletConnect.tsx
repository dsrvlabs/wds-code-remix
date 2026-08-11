import React from 'react';
import { Button, Form, InputGroup, ListGroup } from 'react-bootstrap';
import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClientContext,
  useSuiClientQuery,
  useWallets,
} from '@mysten/dapp-kit';
import { CopyToClipboard } from '../common/CopyToClipboard';

const MIST_PER_SUI = 1_000_000_000;

const WALLET_DOWNLOADS = [
  { name: 'Slush', url: 'https://slush.app/' },
  { name: 'Suiet', url: 'https://suiet.app/' },
  { name: 'Nightly', url: 'https://nightly.app/' },
];

function formatSui(totalBalance: string) {
  const sui = Number(totalBalance) / MIST_PER_SUI;
  return `${sui.toLocaleString(undefined, { maximumFractionDigits: 9 })} SUI`;
}

export const WalletConnect: React.FunctionComponent = () => {
  const wallets = useWallets();
  const account = useCurrentAccount();
  const { network, networks, selectNetwork } = useSuiClientContext();
  const { mutate: connect, isPending: connecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const { data: balance } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address ?? '' },
    { enabled: Boolean(account?.address) },
  );

  return (
    <div>
      <Form.Label htmlFor="wds-network">Network</Form.Label>
      <Form.Select
        id="wds-network"
        size="sm"
        value={network}
        onChange={(e) => selectNetwork(e.target.value)}
        className="mb-3"
      >
        {Object.keys(networks).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </Form.Select>

      {account ? (
        <>
          <Form.Label>Account</Form.Label>
          <InputGroup>
            <Form.Control type="text" value={account.address} size="sm" readOnly />
            <CopyToClipboard tip="Copy" content={account.address} direction="top-end" />
          </InputGroup>

          <Form.Label>Balance</Form.Label>
          <InputGroup>
            <Form.Control
              type="text"
              value={balance ? formatSui(balance.totalBalance) : ''}
              placeholder="Loading…"
              size="sm"
              readOnly
            />
          </InputGroup>

          <Button variant="outline-secondary" size="sm" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </>
      ) : wallets.length > 0 ? (
        <>
          <Form.Label>Wallet</Form.Label>
          <ListGroup>
            {wallets.map((wallet) => (
              <ListGroup.Item
                as="li"
                key={wallet.name}
                action
                disabled={connecting}
                style={{ cursor: 'pointer' }}
                onClick={() => connect({ wallet })}
              >
                <img
                  src={wallet.icon}
                  alt={`${wallet.name} logo`}
                  style={{ width: '20px', marginRight: '10px' }}
                />
                <b>{wallet.name}</b>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </>
      ) : (
        <div className="wds-empty">
          <p>No Sui wallet detected in this browser.</p>
          <p>
            Install one, then press the refresh button above:{' '}
            {WALLET_DOWNLOADS.map((w, i) => (
              <React.Fragment key={w.name}>
                {i > 0 ? ', ' : ''}
                <a href={w.url} target="_blank" rel="noreferrer">
                  {w.name}
                </a>
              </React.Fragment>
            ))}
            .
          </p>
        </div>
      )}
    </div>
  );
};
