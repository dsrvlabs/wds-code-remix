import { FunctionComponent, useState } from 'react';
import { ChainSelectButtonContainer } from './ChainSelectButtonContainer';
import { ChainConnectContainer } from './ChainConnectContainer';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { DocumentationButton } from './DocumentationButton';
import { MakeAIssueButton } from './MakeAIssueButton';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Main: FunctionComponent<InterfaceProps> = ({ client }) => {
  const [chain, setChain] = useState('');

  return (
    <div>
      {chain ? (
        <ChainConnectContainer client={client} chain={chain} setChain={setChain} />
      ) : (
        <div>
          <ChainSelectButtonContainer setChain={setChain} client={client} />
          <DocumentationButton />
          <MakeAIssueButton />
        </div>
      )}
    </div>
  );
};
