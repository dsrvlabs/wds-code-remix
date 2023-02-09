import RefreshButton from './common/RefreshButton';
import { FaChevronLeft } from 'react-icons/fa';
import { Connect as NearConnect } from './near/Connect';
import { Connect as CeloConnect } from './celo/Connect';
import { Connect as KlayConnect } from './klaytn/Connect';
import { Connect as AptosConnect } from './aptos/Connect';
import { Connect as JunoConnect } from './juno/Connect';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { FunctionComponent } from 'react';
import { log } from '../utils/logger';
import { EditorClient } from '../utils/editor';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
  chain: string;
  setChain: Function;
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
};

export const ChainConnectContainer: FunctionComponent<InterfaceProps> = ({
  client,
  chain,
  setChain,
}) => {
  log.debug(chain);

  const handleLeftBtn = async () => {
    setChain('');
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
  };

  const handleRefresh = async () => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    window.location.reload();
  };

  const Header = () => {
    return (
      <div style={STYLE}>
        <div>
          <br />
          <FaChevronLeft onClick={handleLeftBtn} />
          <span style={{ marginLeft: '5px' }}>{chain}</span>
        </div>
        <RefreshButton handleRefresh={handleRefresh} />
      </div>
    );
  };

  const ChainConnect = (props: { chain: string }) => {
    switch (props.chain) {
      case 'Near':
        return <NearConnect client={client} />;
      case 'Celo':
        return <CeloConnect client={client} />;
      case 'Klaytn':
        return <KlayConnect client={client} />;
      case 'Aptos':
        return <AptosConnect client={client} />;
      case 'Juno':
        return <JunoConnect client={client} />;
      default:
        return <></>;
    }
  };

  return (
    <>
      <Header />
      <hr />
      <ChainConnect chain={chain} />
    </>
  );
};
