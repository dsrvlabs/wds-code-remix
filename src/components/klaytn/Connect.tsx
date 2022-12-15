import { useState } from 'react';
import { WelldoneConnect } from './WelldoneConnect';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Connect as CommonConnect } from '../common/Connect';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [active, setActive] = useState<boolean>(false);

  return (
    <div>
      <CommonConnect client={client} active={active} setActive={setActive} />
      <hr />
      <div>
        <WelldoneConnect active={active} client={client} setActive={setActive} />
      </div>
    </div>
  );
};
