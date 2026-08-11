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

const DOCS_LINK = 'https://docs.welldonestudio.io/code/deploy-and-run/sui';
const ISSUES_LINK = 'https://support.welldonestudio.io/';

export const ChainConnectContainer: FunctionComponent<InterfaceProps> = ({ client }) => {
  const handleRefresh = async () => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    window.location.reload();
  };

  return (
    <>
      <div className="wds-header">
        <span className="wds-header__chain">Sui</span>
        <div className="wds-header__links">
          <a href={DOCS_LINK} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Badge pill bg="primary" style={{ color: 'white' }}>
              {'docs'}
            </Badge>
          </a>
          <a href={ISSUES_LINK} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <Badge pill bg="danger" style={{ color: 'white' }}>
              {'issues'}
            </Badge>
          </a>
          <RefreshButton handleRefresh={handleRefresh} />
        </div>
      </div>

      <SuiConnect client={client} />

      <div className="wds-footer">
        <a href={DOCS_LINK} target="_blank" rel="noreferrer">
          <i className="fas fa-book" />
          Documentation
        </a>
        <a href={ISSUES_LINK} target="_blank" rel="noreferrer">
          <i className="fab fa-github" />
          Make an issue
        </a>
      </div>
    </>
  );
};
