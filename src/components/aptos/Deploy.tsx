import React, { useState } from 'react';
import { Button, Card, InputGroup } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { genRawTx, waitForTransactionWithResult } from './aptos-helper';

interface InterfaceProps {
  wallet: string;
  accountID: string;
  metaData64: string;
  moduleBase64s: string[];
  rawTx: string;
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  metaData64,
  moduleBase64s,
  rawTx,
  wallet,
  dapp,
}) => {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('');
  const checkExistContract = async () => {
    if (!dapp) {
      throw new Error('Wallet is not installed');
    }

    if (!accountID) {
      throw new Error('No accountID');
    }

    if (wallet !== 'Dsrv') {
      throw new Error('Wallet is not Dsrv');
    }

    if (!(metaData64 && moduleBase64s.length > 0)) {
      throw new Error('Not prepared metadata and module');
    }

    await dsrvProceed();
  };

  const dsrvProceed = async () => {
    setInProgress(true);
    sendCustomEvent('deploy', {
      event_category: 'aptos',
      method: 'deploy',
    });
    if (!dapp) {
      return;
    }

    try {
      setDeployIconSpin('fa-spin');
      const chainId = dapp.networks.aptos.chain;
      const rawTx_ = await genRawTx(metaData64, moduleBase64s, accountID, chainId);
      const txnHash = await dapp.request('aptos', {
        method: 'dapp:signAndSendTransaction',
        params: [rawTx_],
      });
      log.debug(`@@@ txnHash=${txnHash}`);
      const result = await waitForTransactionWithResult(txnHash, chainId);
      log.debug(result);
    } catch (e: any) {
      log.error(e);
      await client.terminal.log({ type: 'error', value: e?.message?.toString() });
    }
    setInProgress(false);
    setDeployIconSpin('');
    setInProgress(false);
  };

  return (
    <>
      <Card>
        <Card.Header className="p-2">
          Deploy <FaSyncAlt className={deployIconSpin} />
        </Card.Header>
        <Card.Body className="py-1 px-2">
          <InputGroup className="mb-3">
            <Button
              variant="warning"
              size="sm"
              onClick={async () => {
                try {
                  await checkExistContract();
                } catch (e) {
                  log.error(e);
                  setInProgress(false);
                }
              }}
              disabled={inProgress || !rawTx}
            >
              <small>Deploy</small>
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>
    </>
  );
};
