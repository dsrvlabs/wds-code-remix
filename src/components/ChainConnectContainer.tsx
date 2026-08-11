import RefreshButton from './common/RefreshButton';
import { Connect as SuiConnect } from './sui/Connect';

import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { FunctionComponent } from 'react';
import { EditorClient } from '../utils/editor';
import Badge from 'react-bootstrap/Badge';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

const STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  position: 'sticky',
  top: 0,
  backgroundColor: 'var(--body-bg)',
  zIndex: 3,
  paddingBottom: '10px',
  marginTop: '40px',
};

const DOCS_LINK = 'https://docs.welldonestudio.io/code/deploy-and-run/sui';
const ISSUES_LINK = 'https://support.welldonestudio.io/';

export const ChainConnectContainer: FunctionComponent<InterfaceProps> = ({ client }) => {
  const handleRefresh = async () => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    window.location.reload();
  };

  const Header = () => {
    return (
      <div style={STYLE}>
        <div className="d-flex align-items-center">
          <span>Sui</span>
        </div>
        <div className="d-flex align-items-center">
          <a href={DOCS_LINK} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Badge pill bg="primary" style={{ color: 'white', marginRight: '10px' }}>
              {'docs'}
            </Badge>
          </a>
          <a href={ISSUES_LINK} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Badge
              pill
              bg="danger"
              className="me-2"
              style={{ color: 'white', marginRight: '10px' }}
            >
              {'issues'}
            </Badge>
          </a>
          <RefreshButton handleRefresh={handleRefresh} />
        </div>
      </div>
    );
  };

  return (
    <>
      <Header />
      <div style={{ height: '0.7em' }}></div>
      <SuiConnect client={client} />
    </>
  );
};
