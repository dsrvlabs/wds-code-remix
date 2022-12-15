import React from 'react';
import { Form, InputGroup, Tooltip, Button, OverlayTrigger } from 'react-bootstrap';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import Compiler from './Compiler';
import SmartContracts from './SmartContracts';
import { InterfaceContract } from '../../utils/Types';

interface InterfaceProps {
  dapp: any;
  account: string;
  balance: string;
  client: any;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({
  dapp,
  account,
  balance,
  client,
}) => {
  const [busy, setBusy] = React.useState<boolean>(false);
  // const [celo] = React.useState<Celo>(new Celo(NETWORKS.Mainnet));
  const [atAddress, setAtAddress] = React.useState<string>('');
  const [contracts, setContracts] = React.useState<InterfaceContract[]>([]);
  const [selected, setSelected] = React.useState<InterfaceContract | null>(null);

  function addNewContract(contract: InterfaceContract) {
    setContracts(contracts.concat([contract]));
  }

  return (
    <>
      <Form>
        <Form.Group>
          <Form.Text className="text-muted">
            <small>ACCOUNT</small>
          </Form.Text>
          <InputGroup>
            <Form.Control type="text" placeholder="Account" value={account} size="sm" readOnly />
          </InputGroup>
        </Form.Group>
        <Form.Group>
          <Form.Text className="text-muted">
            <small>BALANCE (KLAY)</small>
          </Form.Text>
          <InputGroup>
            <Form.Control type="text" placeholder="Account" value={balance} size="sm" readOnly />
          </InputGroup>
        </Form.Group>
      </Form>
      <hr />
      <Compiler
        client={client}
        dapp={dapp}
        account={account}
        busy={busy}
        setBusy={setBusy}
        addNewContract={addNewContract}
        setSelected={setSelected}
      />
      <p className="text-center mt-3">
        <small>OR</small>
      </p>
      <InputGroup className="mb-3">
        <Form.Control
          value={atAddress}
          placeholder="contract address"
          onChange={(e) => {
            setAtAddress(e.target.value);
          }}
          size="sm"
          disabled={busy || account === '' || !selected}
        />
        <OverlayTrigger
          placement="left"
          overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract address</Tooltip>}
        >
          <Button
            variant="primary"
            size="sm"
            disabled={busy || account === '' || !selected}
            onClick={() => {
              sendCustomEvent('at_address', {
                event_category: 'klaytn',
                method: 'at_address',
              });
              setBusy(true);
              if (selected) {
                addNewContract({ ...selected, address: atAddress });
              }
              setBusy(false);
            }}
          >
            <small>At Address</small>
          </Button>
        </OverlayTrigger>
      </InputGroup>
      <hr />
      <SmartContracts
        dapp={dapp}
        account={account}
        busy={busy}
        setBusy={setBusy}
        contracts={contracts}
        client={client}
      />
    </>
  );
};
