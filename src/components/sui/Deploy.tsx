import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  dappPublishTxn,
  getAccountResources,
  SuiChainId,
  waitForTransactionWithResult,
} from './sui-helper';

import copy from 'copy-to-clipboard';
import { isNotEmptyList } from '../../utils/ListUtil';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { CompiledModulesAndDeps } from 'wds-event';

export interface SuiDeployHistoryCreateDto {
  chainId: string;
  account: string;
  package: string;
  compileTimestamp: number;
  deployTimestamp: number;
  txHash: string;
  modules: string[];
}

interface InterfaceProps {
  wallet: string;
  accountID: string;
  compileTimestamp: string;
  packageName: string;
  compiledModulesAndDeps: CompiledModulesAndDeps;
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
  compileTimestamp,
  packageName,
  compiledModulesAndDeps,
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
      // todo uncomment
      throw new Error('Wallet is not installed');
    }

    if (!accountID) {
      throw new Error('No accountID');
    }

    if (wallet !== 'Dsrv') {
      throw new Error('Wallet is not Dsrv');
    }

    if (!compiledModulesAndDeps) {
      throw new Error('Not prepared metadata and module');
    }

    await dsrvProceed();
  };

  const dsrvProceed = async () => {
    setInProgress(true);
    sendCustomEvent('deploy', {
      event_category: 'sui',
      method: 'deploy',
    });

    if (!dapp) {
      return;
    }

    try {
      setDeployIconSpin('fa-spin');
      const rawTx_ = await dappPublishTxn(
        accountID,
        dapp.networks.sui.chain as SuiChainId,
        compiledModulesAndDeps,
      );

      const txnHash = await dapp.request('sui', {
        method: 'dapp:signAndSendTransaction',
        params: [rawTx_],
      });
      log.debug(`@@@ txnHash=${txnHash}`);

      const result = (await waitForTransactionWithResult(txnHash, dapp.networks.sui.chain)) as any;
      log.info('tx result', result);
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
        const suiDeployHistoryCreateDto: SuiDeployHistoryCreateDto = {
          chainId: dapp.networks.sui.chain,
          account: accountID,
          package: packageName,
          compileTimestamp: Number(compileTimestamp),
          deployTimestamp: Number(result.timestamp),
          txHash: result.hash,
          modules: ['abc'].map((m) => m), // todo
        };

        log.info('suiDeployHistoryCreateDto', suiDeployHistoryCreateDto);

        const res = await axios.post(
          COMPILER_API_ENDPOINT + '/sui-deploy-histories',
          suiDeployHistoryCreateDto,
        );

        log.info(`sui-deploy-histories api res`, res);

        setDeployedContract(accountID);
        setAtAddress('');
        const moveResources = await getAccountResources(accountID, dapp.networks.sui.chain);
        log.info(`@@@ moveResources`, moveResources);
        setAccountResources([...moveResources]);
        if (isNotEmptyList(moveResources)) {
          setTargetResource(moveResources[0].type);
        } else {
          setTargetResource('');
        }
        setParameters([]);

        getAccountModulesFromAccount(accountID, dapp.networks.sui.chain);
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

  // suiClient.getAccountResources(accountID).then((res) => {
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
          disabled={inProgress || !compiledModulesAndDeps}
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
