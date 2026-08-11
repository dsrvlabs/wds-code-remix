import { Form, ListGroup } from 'react-bootstrap';

import Sui from '../assets/Sui-Big.png';
import RefreshButton from './common/RefreshButton';
import { FunctionComponent } from 'react';
import { EditorClient } from '../utils/editor';
import { IRemixApi } from '@remixproject/plugin-api';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';

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
      </Form.Group>
    </div>
  );
};
