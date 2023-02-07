import React, { useState } from 'react';
import { Button, Card, InputGroup, Form as ReactForm } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { genRawTx, getAccountResources, waitForTransactionWithResult } from './aptos-helper';

import copy from 'copy-to-clipboard';
import { isNotEmptyList } from '../../utils/ListUtil';

interface InterfaceProps {
  wallet: string;
  accountID: string;
  metaData64: string;
  moduleBase64s: string[];
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
  setDeployedContract: Function;
  setAtAddress: Function;
  setAccountResources: Function;
  setTargetResource: Function;
  setParameters: Function;
  getAccountModulesFromAccount: Function;
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  metaData64,
  moduleBase64s,
  wallet,
  dapp,
  setDeployedContract,
  setAtAddress,
  setAccountResources,
  setTargetResource,
  setParameters,
  getAccountModulesFromAccount,
}) => {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('');
  const [abi, setABI] = useState<any>({});
  const [param, setParam] = useState<string>('');
  const [resource, setResource] = useState<string>('');

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
      const rawTx_ = await genRawTx(metaData64, moduleBase64s, accountID, chainId, 20000, 100);
      const txnHash = await dapp.request('aptos', {
        method: 'dapp:signAndSendTransaction',
        params: [rawTx_],
      });
      log.debug(`@@@ txnHash=${txnHash}`);

      /**
       * Config for creating raw transactions.
       */
      // interface ABIBuilderConfig {
      //   sender: MaybeHexString | AccountAddress;
      //   sequenceNumber: Uint64 | string;
      //   gasUnitPrice: Uint64 | string;
      //   maxGasAmount?: Uint64 | string;
      //   expSecFromNow?: number | string;
      //   chainId: Uint8 | string;
      // }

      const result = (await waitForTransactionWithResult(txnHash, chainId)) as any;
      log.debug(result);
      if (result.success) {
        await client.terminal.log({
          type: 'info',
          value: {
            version: result.version,
            hash: result.hash,
            gas_unit_price: result.gas_unit_price,
            gas_used: result.gas_used,
            sender: result.sender,
            sequence_number: result.sequence_number,
            timestamp: result.timestamp,
            vm_status: result.vm_status,
          },
        });
        setDeployedContract(accountID);
        setAtAddress('');
        const moveResources = await getAccountResources(accountID, dapp.networks.aptos.chain);
        log.info(`@@@ moveResources`, moveResources);
        setAccountResources([...moveResources]);
        if (isNotEmptyList(moveResources)) {
          setTargetResource(moveResources[0].type);
        } else {
          setTargetResource('');
        }
        setParameters([]);

        getAccountModulesFromAccount(accountID, dapp.networks.aptos.chain);
      } else {
        log.error((result as any).vm_status);
        await client.terminal.log({ type: 'error', value: (result as any).vm_status });
      }
    } catch (e: any) {
      log.error(e);
      await client.terminal.log({ type: 'error', value: e?.message?.toString() });
    }
    setInProgress(false);
    setDeployIconSpin('');
    setInProgress(false);
  };

  // aptosClient.getAccountResources(accountID).then((res) => {
  //   console.log('getAccountResources', res)
  //   res.map(async (accountResource: any)=>{
  //     if(accountResource.type === accountID+"::"+abi.name+"::"+resource){
  //       console.log(accountResource.data)
  //       await client.terminal.log({
  //         type: 'info',
  //         value: accountResource.data
  //       });
  //     }
  //   })
  // })

  return (
    <>
      <div className="d-grid gap-2">
        <Button
          variant="warning"
          disabled={inProgress || !metaData64}
          onClick={async () => {
            try {
              await checkExistContract();
            } catch (e) {
              log.error(e);
              setInProgress(false);
            }
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span> Deploy</span>
        </Button>
        {Object.keys(abi).length ? (
          <div style={{ textAlign: 'right', marginBottom: '3px' }}>
            {'ABI   '}
            <i
              className="far fa-copy"
              onClick={() => {
                copy(JSON.stringify(abi, null, 4));
              }}
            />
          </div>
        ) : (
          false
        )}
      </div>
      <hr />
    </>
  );
};
