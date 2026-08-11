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
import type { WalletWithRequiredFeatures } from '@mysten/wallet-standard';
import { CopyToClipboard } from '../common/CopyToClipboard';
import { SectionTitle } from '../common/SectionTitle';

const MIST_PER_SUI = 1_000_000_000;

/**
 * Wallets we offer even when they are not installed, so the list never comes
 * up empty. Each site routes to the right store for the current browser.
 */
const KNOWN_WALLETS = [
  { name: 'Slush', site: 'https://slush.app/' },
  { name: 'Suiet', site: 'https://suiet.app/' },
  { name: 'Nightly', site: 'https://nightly.app/' },
  { name: 'Ethos', site: 'https://ethoswallet.xyz/' },
  { name: 'Backpack', site: 'https://backpack.app/' },
];

type Row =
  | { kind: 'installed'; name: string; icon: string; wallet: WalletWithRequiredFeatures }
  | { kind: 'install'; name: string; site: string };

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
      rows.push({ kind: 'install', name: known.name, site: known.site });
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

  const { data: balance } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address ?? '' },
    { enabled: Boolean(account?.address) },
  );

  const rows = buildRows(wallets);

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
        <ListGroup className="wds-wallets">
          {rows.map((row) =>
            row.kind === 'installed' ? (
              <ListGroup.Item
                as="li"
                key={row.name}
                action
                disabled={connecting}
                onClick={() => connect({ wallet: row.wallet })}
              >
                <img src={row.icon} alt="" className="wds-wallets__icon" />
                <b>{row.name}</b>
              </ListGroup.Item>
            ) : (
              <ListGroup.Item
                as="a"
                key={row.name}
                action
                href={row.site}
                target="_blank"
                rel="noreferrer"
              >
                <i className="fas fa-wallet wds-wallets__icon" />
                <b>{row.name}</b>
                <span className="wds-wallets__hint">Install</span>
              </ListGroup.Item>
            ),
          )}
        </ListGroup>
      )}
    </div>
  );
};
