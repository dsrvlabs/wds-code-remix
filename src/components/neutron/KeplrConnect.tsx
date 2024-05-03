import { useEffect, useState } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import { StargateClient } from '@cosmjs/stargate';

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
  setProviderNetwork
}) => {
  const [balance, setBalance] = useState<null | string>();
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('neutron-1');

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
            enableKeplr()
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
    await (keplrInstance as any).enable(network);
    const offlineSigner = (keplrInstance as any).getOfflineSigner(network);
    const accounts = await offlineSigner.getAccounts();

    let rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
    
    let denom = 'untrn';
    if (network === 'pion-1') {
      rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
      denom = 'untrn';
    }

    const stargateClient = await StargateClient.connect(rpcUrl);
    const bal = await stargateClient.getBalance(accounts[0].address, 'untrn')

    setAccount(accounts[0].address)
    setBalance(formatDecimal(Number(bal.amount)))
  }

  const handleNetwork = (e: any) => {
    setNetwork(e.target.value);
    setProviderNetwork(e.target.value)
  }

  const formatDecimal = (value: number, decimalPlaces = 6) => {
    const num = value / Math.pow(10, decimalPlaces);
    return num.toFixed(3);
  }

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
