import { FunctionComponent } from 'react';
import { ChainConnectContainer } from './ChainConnectContainer';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Main: FunctionComponent<InterfaceProps> = ({ client }) => {
  return <ChainConnectContainer client={client} />;
};
