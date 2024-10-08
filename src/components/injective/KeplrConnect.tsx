import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { useWalletStore } from './WalletContextProvider';
import { ChainId } from '@injectivelabs/ts-types';
import { Wallet } from '@injectivelabs/wallet-ts';

export const KeplrConnect: React.FunctionComponent = () => {
  const [error, setError] = useState<String>('');
  const { chainId, setChainId, balance, injectiveAddress: walletAccount, init } = useWalletStore();
  const networks = useMemo(
    () => [
      { name: 'Mainnet', value: ChainId.Mainnet },
      { name: 'Testnet', value: ChainId.Testnet },
    ],
    [],
  );

  useEffect(() => {
    init(Wallet.Keplr);
  }, []);
  
  const handleNetwork = (e: any) => {
    setChainId(e.target.value);
  };
  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group>
        <Form.Label>Network</Form.Label>
        <Form.Control as="select" value={chainId} onChange={handleNetwork} size="sm">
          {networks.map((net, idx) => (
            <option key={idx} value={net.value}>
              {net.name}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      <Form>
        <Form.Text className="text-muted" style={mb4}>
          <small>ACCOUNT</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Account"
            value={walletAccount ? walletAccount : ''}
            size="sm"
            readOnly
          />
        </InputGroup>
        <Form.Text className="text-muted" style={mb4}>
          <small>BALANCE</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="Balance"
            value={walletAccount ? balance || '' : ''}
            size="sm"
            readOnly
          />
        </InputGroup>
      </Form>
    </div>
  );
};

const mb4 = {
  marginBottom: '4px',
};
