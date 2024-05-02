import { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { NetworkUI } from '../common/Network';
import { convertToRealChainId } from './neutron-helper';

interface InterfaceProps {
  active: boolean;
  setAccount: Function;
  account: string;
  setWalletRpcProvider: Function;
  walletRpcProvider: any;
  setDapp: Function;
  client: any;
  setActive: Function;
}

export const KeplrConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  walletRpcProvider,
  setWalletRpcProvider,
  setDapp,
  setActive,
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('');
  const [keplr, setKeplr] = useState(undefined);

  const networks = [
    { name: 'Mainnet', value: 'neutron-1' },
    { name: 'Testnet', value: 'pion-1' }
  ];

  const getKeplr = async () => {
    if ((window as any).keplr) {
      return (window as any).keplr;
    }
    
    if (document.readyState === "complete") {
      return (window as any).keplr;
    }
    
    return new Promise((resolve) => {
      const documentStateChange = (event: Event) => {
        if (
          event.target &&
          (event.target as Document).readyState === "complete"
        ) {
          resolve((window as any).keplr);
          document.removeEventListener("readystatechange", documentStateChange);
        }
      };
      document.addEventListener("readystatechange", documentStateChange);
    });
  }

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
          const keplrInstance = await getKeplr();
          if (!keplrInstance) {
            console.log('Keplr not found.');
            setActive(false); 
          } else {
            setKeplr(keplrInstance);
            console.log('Keplr is ready.'); 
            console.log(keplr);
          }
        } catch (error) {
          console.error('Failed to connect Keplr:', error);
        }
      }
    };
    connect();
  }, [active, keplr]);

  return (
    <div>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group>
        <Form.Label>Network</Form.Label>
        <Form.Control as="select" value={network} onChange={(e) => {setNetwork(e.target.value);(keplr as any).enable(network);}} size="sm">
          {networks.map((net, idx) => (
            <option key={idx} value={net.value}>{net.name}</option>
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
