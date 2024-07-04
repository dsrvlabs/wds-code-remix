import { Badge, Form, ListGroup } from 'react-bootstrap';

import Aptos from '../assets/Aptos-Big.png';
import Sui from '../assets/Sui-Big.png';
import Neutron from '../assets/Neutron-Big.svg';
import Near from '../assets/Near-Big.png';
import Celo from '../assets/Celo-Big.png';
import Juno from '../assets/Juno-Big.png';
import Klaytn from '../assets/Klaytn-Big.png';
import Arbitrum from '../assets/Arbitrum.png';
import Injective from '../assets/Injective-Big.png';
import RefreshButton from './common/RefreshButton';
import { FunctionComponent } from 'react';
import { EditorClient } from '../utils/editor';
import { IRemixApi } from '@remixproject/plugin-api';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { PROD, STAGE } from '../const/stage';

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
        {/*{STAGE !== PROD ? (*/}
        <ListGroup.Item
          as="li"
          style={{ cursor: 'pointer' }}
          action
          onClick={() => {
            setChain('Injective');
          }}
        >
          <img
            src={Injective}
            style={{ width: '35px', marginRight: '20px' }}
            alt="Injective logo"
          />
          <b>Injective (CosmWasm)</b>
        </ListGroup.Item>
        <ListGroup.Item
          as="li"
          style={{ cursor: 'pointer' }}
          action
          onClick={() => {
            setChain('Arbitrum');
          }}
        >
          <img src={Arbitrum} style={{ width: '35px', marginRight: '20px' }} alt="Arbitrum logo" />
          <b>Arbitrum (Stylus)</b>
          <Badge bg="danger" style={{ position: 'absolute', right: '10px', top: '0px' }}>
            Beta
          </Badge>
        </ListGroup.Item>
        {/*) : null}*/}

        <ListGroup.Item
          as="li"
          style={{ cursor: 'pointer' }}
          action
          onClick={() => {
            setChain('Neutron');
          }}
        >
          <img src={Neutron} style={{ width: '35px', marginRight: '20px' }} alt="Neutron logo" />
          <b>Neutron (CosmWasm)</b>
        </ListGroup.Item>
        <ListGroup.Item
          as="li"
          style={{ cursor: 'pointer' }}
          action
          onClick={() => {
            setChain('Sui');
          }}
        >
          <img src={Sui} style={{ width: '35px', marginRight: '20px' }} alt="Sui logo" />
          <b>Sui (MoveVM)</b>
        </ListGroup.Item>
        <ListGroup>
          <ListGroup.Item
            as="li"
            style={{ cursor: 'pointer' }}
            action
            onClick={() => {
              setChain('Aptos');
            }}
          >
            <img src={Aptos} style={{ width: '35px', marginRight: '20px' }} alt="Aptos logo" />
            <b>Aptos (MoveVM)</b>
          </ListGroup.Item>

          {/* <ListGroup.Item
            as="li"
            style={{ cursor: 'pointer' }}
            action
            onClick={() => {
              setChain('Juno');
            }}
          >
            <img src={Juno} style={{ width: '35px', marginRight: '20px' }} alt="Juno logo" />
            <b>Juno (CosmWasm)</b>
          </ListGroup.Item> */}
          <ListGroup.Item
            as="li"
            style={{ cursor: 'pointer' }}
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
            style={{ cursor: 'pointer' }}
            action
            onClick={() => {
              setChain('Celo');
            }}
          >
            <img src={Celo} style={{ width: '35px', marginRight: '20px' }} alt="Celo logo" />
            <b>CELO (EVM)</b>
          </ListGroup.Item>
          {/* <ListGroup.Item
            as="li"
            style={{ cursor: 'pointer' }}
            action
            onClick={() => {
              setChain('Klaytn');
            }}
          >
            <img src={Klaytn} style={{ width: '35px', marginRight: '20px' }} alt="Klaytn logo" />
            <b>Klaytn (EVM)</b>
          </ListGroup.Item> */}
        </ListGroup>
      </Form.Group>
    </div>
  );
};
