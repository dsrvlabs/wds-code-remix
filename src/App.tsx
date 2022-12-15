import React, { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { Main } from './components/Main';

import type { Api } from '@remixproject/plugin-utils';
import { Client } from '@remixproject/plugin';
import { IRemixApi } from '@remixproject/plugin-api';
import { createClient } from '@remixproject/plugin-iframe';
import { log } from './utils/logger';

export const App: React.FunctionComponent = () => {
  const [client, setClient] = useState<Client<Api, Readonly<IRemixApi>> | undefined | null>(null);
  const [connection, setConnection] = useState<boolean>(false);

  useEffect(() => {
    const init = async () => {
      const temp = createClient();
      await temp.onload();

      setClient(temp);
      setConnection(true);
    };
    if (!connection) init();
    log.debug(`%cẅël̈l̈c̈öm̈ë-̈ẗö-̈ẅël̈l̈d̈ön̈ë-̈c̈öd̈ë!̈`, 'color:yellow');
  }, []);

  return (
    <div className="App">
      <Container>{client && <Main client={client} />}</Container>
    </div>
  );
};

export default App;
