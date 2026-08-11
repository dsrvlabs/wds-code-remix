import React, { useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import {
  useConnectWallet,
  useCurrentAccount,
  useDisconnectWallet,
  useSuiClientContext,
  useSuiClientQuery,
  useWallets,
} from '@mysten/dapp-kit';
import type { WalletWithRequiredFeatures } from '@mysten/wallet-standard';
import { CopyToClipboard } from '../common/CopyToClipboard';
import { SectionTitle } from '../common/SectionTitle';

const MIST_PER_SUI = 1_000_000_000;

/**
 * Wallets we offer even when they are not installed, so the panel always has
 * something to press. Each site routes to the right store for the browser.
 * Slush leads: it is the wallet Mysten ships for Sui.
 */
const KNOWN_WALLETS = [
  { name: 'Slush', site: 'https://slush.app/', tint: '#4da2ff' },
  { name: 'Suiet', site: 'https://suiet.app/', tint: '#5a68ff' },
  { name: 'Nightly', site: 'https://nightly.app/', tint: '#8b5cf6' },
  { name: 'Ethos', site: 'https://ethoswallet.xyz/', tint: '#22c55e' },
  { name: 'Backpack', site: 'https://backpack.app/', tint: '#e5484d' },
];

type Row =
  | { kind: 'installed'; name: string; icon: string; wallet: WalletWithRequiredFeatures }
  | { kind: 'install'; name: string; site: string; tint: string };

function formatSui(totalBalance: string) {
  const sui = Number(totalBalance) / MIST_PER_SUI;
  return `${sui.toLocaleString(undefined, { maximumFractionDigits: 9 })} SUI`;
}

function buildRows(installed: readonly WalletWithRequiredFeatures[]): Row[] {
  const rows: Row[] = installed.map((wallet) => ({
    kind: 'installed',
    name: wallet.name,
    icon: wallet.icon,
    wallet,
  }));

  const isInstalled = (name: string) =>
    installed.some((wallet) => wallet.name.toLowerCase().includes(name.toLowerCase()));

  for (const known of KNOWN_WALLETS) {
    if (!isInstalled(known.name)) {
      rows.push({ kind: 'install', ...known });
    }
  }

  return rows;
}

export const WalletConnect: React.FunctionComponent = () => {
  const wallets = useWallets();
  const account = useCurrentAccount();
  const { network, networks, selectNetwork } = useSuiClientContext();
  const { mutate: connect, isPending: connecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const [showAll, setShowAll] = useState(false);

  const { data: balance } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address ?? '' },
    { enabled: Boolean(account?.address) },
  );

  const rows = buildRows(wallets);
  const [lead, ...rest] = rows;

  const WalletRow = ({ row, lead: isLead }: { row: Row; lead?: boolean }) => {
    const className = isLead ? 'wds-wallet wds-wallet--lead' : 'wds-wallet';

    const mark =
      row.kind === 'installed' ? (
        <img src={row.icon} alt="" className="wds-wallet__mark" />
      ) : (
        <span className="wds-wallet__mark wds-wallet__mark--letter" style={{ color: row.tint }}>
          {row.name.charAt(0)}
        </span>
      );

    if (row.kind === 'installed') {
      return (
        <button
          type="button"
          className={className}
          disabled={connecting}
          onClick={() => connect({ wallet: row.wallet })}
        >
          {mark}
          <b>{row.name}</b>
          <span className="wds-wallet__hint">{connecting ? 'Connecting…' : 'Connect'}</span>
        </button>
      );
    }

    return (
      <a className={className} href={row.site} target="_blank" rel="noreferrer">
        {mark}
        <b>{row.name}</b>
        <span className="wds-wallet__hint">Install</span>
      </a>
    );
  };

  return (
    <div>
      <SectionTitle>Wallet</SectionTitle>
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
      ) : (
        <div className="wds-wallets">
          {lead && <WalletRow row={lead} lead />}

          {rest.length > 0 && (
            <>
              <button
                type="button"
                className="wds-wallets__toggle"
                aria-expanded={showAll}
                onClick={() => setShowAll((open) => !open)}
              >
                <i className={`fas fa-chevron-${showAll ? 'up' : 'down'}`} />
                {showAll ? 'Fewer wallets' : `More wallets (${rest.length})`}
              </button>

              {showAll && (
                <div className="wds-wallets__more">
                  {rest.map((row) => (
                    <WalletRow key={row.name} row={row} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
