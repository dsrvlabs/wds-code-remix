import { Badge, Form, ListGroup } from 'react-bootstrap';

import Aptos from '../assets/Aptos-Big.png';
import Sui from '../assets/Sui-Big.png';
import Near from '../assets/Near-Big.png';
import Celo from '../assets/Celo-Big.png';
import Juno from '../assets/Juno-Big.png';
import Klaytn from '../assets/Klaytn-Big.png';
import RefreshButton from './common/RefreshButton';
import { FunctionComponent } from 'react';
import { EditorClient } from '../utils/editor';
import { IRemixApi } from '@remixproject/plugin-api';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { enableSui } from '../utils/helper';

interface InterfaceProps {
  setChain: Function;
  client: Client<Api, Readonly<IRemixApi>>;
}

export const ChainSelectButtonContainer: FunctionComponent<InterfaceProps> = ({
  setChain,
  client,
}) => {
  const handleRefresh = async () => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    window.location.reload();
  };

  return (
    <div>
      <Form.Group>
        <Form.Text
          className="text-muted"
          style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}
        >
          <span>Select a Chain</span>
          <RefreshButton handleRefresh={handleRefresh} />
        </Form.Text>
        {enableSui() ? (
          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Sui');
            }}
          >
            <img src={Sui} style={{ width: '35px', marginRight: '20px' }} alt="Sui logo" />
            <b>SUI (MoveVM)</b>
            <Badge bg="danger" style={{ position: 'absolute', right: '10px', top: '20px' }}>
              Beta
            </Badge>
          </ListGroup.Item>
        ) : (
          false
        )}
        <ListGroup>
          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Aptos');
            }}
          >
            <img src={Aptos} style={{ width: '35px', marginRight: '20px' }} alt="Aptos logo" />
            <b>APTOS (MoveVM)</b>
            <Badge bg="danger" style={{ position: 'absolute', right: '10px', top: '20px' }}>
              Beta
            </Badge>
          </ListGroup.Item>

          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Juno');
            }}
          >
            <img src={Juno} style={{ width: '35px', marginRight: '20px' }} alt="Juno logo" />
            <b>JUNO (CosmWasm)</b>
            <Badge bg="danger" style={{ position: 'absolute', right: '10px', top: '20px' }}>
              Beta
            </Badge>
          </ListGroup.Item>
          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Near');
            }}
          >
            <img src={Near} style={{ width: '35px', marginRight: '20px' }} alt="Near logo" />
            <b>NEAR (NVM)</b>
          </ListGroup.Item>
          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Celo');
            }}
          >
            <img src={Celo} style={{ width: '35px', marginRight: '20px' }} alt="Celo logo" />
            <b>CELO (EVM)</b>
          </ListGroup.Item>
          <ListGroup.Item
            as="li"
            action
            onClick={() => {
              setChain('Klaytn');
            }}
          >
            <img src={Klaytn} style={{ width: '35px', marginRight: '20px' }} alt="Klaytn logo" />
            <b>KLAYTN (EVM)</b>
          </ListGroup.Item>
        </ListGroup>
      </Form.Group>
    </div>
  );
};
