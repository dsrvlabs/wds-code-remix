import { useEffect, useMemo, useState } from 'react';
import { StargateClient } from '@cosmjs/stargate';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setWalletRpcProvider: Function;
  walletRpcProvider: any;
  setKeplr: Function;
  client: any;
  setActive: Function;
  setProviderNetwork: Function;
}
export const KeplrConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  walletRpcProvider,
  setWalletRpcProvider,
  setKeplr,
  setActive,
  setProviderNetwork,
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('injective-888');

  const networks = useMemo(
    () => [
      { name: 'Mainnet', value: 'injective-1' },
      { name: 'Testnet', value: 'injective-888' },
    ],
    [],
  );

  const keplrInstance = (window as any).keplr;

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
          if (!keplrInstance) {
            console.log('Keplr not found.');
            setActive(false);
          } else {
            setKeplr(keplrInstance);
            console.log('Keplr is ready.');
            enableKeplr();
          }
        } catch (error) {
          console.error('Failed to connect Keplr:', error);
        }
      }
    };
    connect();
  }, [active, keplrInstance]);

  useEffect(() => {
    const updateKeplr = async () => {
      if (keplrInstance) {
        await enableKeplr();
      }
    };
    updateKeplr();
  }, [network, keplrInstance]);

  const enableKeplr = async () => {
    try {
      await (keplrInstance as any).enable(network);
      const accounts = await (keplrInstance as any).getOfflineSigner(network).getAccounts();
      //TODO: Change RPC URL
      let rpcUrl = 'https://sentry.tm.injective.network:443';
      let denom = 'inj';

      if (network === 'injective-888') {
        rpcUrl = 'https://testnet.sentry.tm.injective.network:443';
      }

      const injStargateClient = await StargateClient.connect(rpcUrl);
      const bal = await injStargateClient.getBalance(accounts[0].address, 'inj');
      setAccount(accounts[0].address);
      setBalance(formatDecimal(Number(bal.amount)));
      gtag('event', 'login', {
        event_category: 'authentication',
        event_label: 'keplr_wallet_connection',
        method: 'injective',
      });
    } catch (error) {
      console.error(error);
      setError(
        'Error! Check your Keplr Wallet \n Injective Address not detected please add Injective Chain',
      );
      setActive(false);
    }
  };

  const handleNetwork = (e: any) => {
    setNetwork(e.target.value);
    setProviderNetwork(e.target.value);
  };

  const formatDecimal = (value: number, decimalPlaces = 6) => {
    const num = value / Math.pow(10, decimalPlaces);
    return num.toFixed(3);
  };
  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group>
        <Form.Label>Network</Form.Label>
        <Form.Control as="select" value={network} onChange={handleNetwork} size="sm">
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
            value={account ? account : ''}
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
            value={account ? balance || '' : ''}
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
