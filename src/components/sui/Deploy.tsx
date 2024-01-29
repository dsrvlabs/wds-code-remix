import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { dappPublishTxn, SuiChainId, waitForTransactionWithResult } from './sui-helper';

import copy from 'copy-to-clipboard';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { CompiledModulesAndDeps } from 'wds-event';
import { isEmptyList } from '../../utils/ListUtil';

export interface SuiDeployHistoryCreateDto {
  chainId: string;
  account: string;
  packageId: string;
  packageName: string;
  compileTimestamp: number | null;
  deployTimestamp: number | null;
  txHash: string;
  status: string | null;
  cliVersion: string | null;
  isSrcUploaded: boolean;
  modules: string[];
}

interface InterfaceProps {
  wallet: string;
  accountID: string;
  compileTimestamp: string;
  cliVersion: string;
  packageName: string;
  compiledModulesAndDeps: CompiledModulesAndDeps;
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
  gas: string;
  setDeployedContract: Function;
  setAtAddress: Function;
  setSuiObjects: Function;
  setTargetObjectId: Function;
  setGenericParameters: Function;
  setParameters: Function;
  setInputAddress: Function;
  initContract: Function;
  uploadCodeChecked: boolean;
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  compileTimestamp,
  cliVersion,
  packageName,
  compiledModulesAndDeps,
  wallet,
  dapp,
  gas,
  setDeployedContract,
  setAtAddress,
  setSuiObjects,
  setTargetObjectId,
  setGenericParameters,
  setParameters,
  setInputAddress,
  initContract,
  uploadCodeChecked,
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

    setDeployIconSpin('fa-spin');
    const rawTx_ = await dappPublishTxn(
      accountID,
      dapp.networks.sui.chain as SuiChainId,
      compiledModulesAndDeps,
      Number(gas),
    );

    const txnHash: string[] = await dapp.request('sui', {
      method: 'dapp:signAndSendTransaction',
      params: [rawTx_],
    });
    if (isEmptyList(txnHash)) {
      console.error(`dapp:signAndSendTransaction fail`);
      return;
    }
    log.info('@@@ txnHash', txnHash);

    let result;
    try {
      result = await waitForTransactionWithResult(txnHash, dapp.networks.sui.chain);
    } catch (e) {
      console.error(e);
      await client.terminal.log({
        type: 'error',
        value: `Failed to get transaction block for ${txnHash}`,
      });
      // todo fail handling.
      return;
    }
    log.info('tx result', result);

    if (result.effects?.status?.status !== 'success') {
      log.error(result);
      await client.terminal.log({ type: 'error', value: JSON.stringify(result, null, 2) });
      return;
    }

    await client.terminal.log({
      type: 'info',
      value: `-------------------- ${txnHash} --------------------`,
    });
    await client.terminal.log({
      type: 'info',
      value: JSON.stringify(result, null, 2),
    });

    const objectChanges = result.objectChanges || [];
    log.info('objectChanges', objectChanges);
    const publishedChange = objectChanges.find((oc) => oc.type === 'published') as
      | {
          packageId: string;
          type: 'published';
          version: number;
          digest: string;
          modules: string[];
        }
      | undefined;

    if (!publishedChange) {
      log.error(`no publishedChange`);
      return;
    }

    if (!publishedChange.packageId) {
      log.error(`no packageId`, publishedChange);
      return;
    }
    const modules = publishedChange.modules || [];

    const suiDeployHistoryCreateDto: SuiDeployHistoryCreateDto = {
      chainId: dapp.networks.sui.chain,
      account: accountID,
      packageId: publishedChange.packageId,
      packageName: packageName,
      compileTimestamp: Number(compileTimestamp),
      deployTimestamp: Number(result.timestampMs) || 0,
      txHash: result.digest,
      isSrcUploaded: uploadCodeChecked,
      status: result.effects.status.status,
      cliVersion: cliVersion || null,
      modules: modules,
    };
    log.info('suiDeployHistoryCreateDto', suiDeployHistoryCreateDto);

    try {
      const res = await axios.post(
        COMPILER_API_ENDPOINT + '/sui-deploy-histories',
        suiDeployHistoryCreateDto,
      );
      log.info(`sui-deploy-histories api res`, res);
    } catch (e) {
      log.error(`sui-deploy-histories api error`);
      console.error(e);
    }

    try {
      const res = await axios.post(
        COMPILER_API_ENDPOINT + '/sui/packages',
        suiDeployHistoryCreateDto,
      );
      log.info(`sui-packages api res`, res);
    } catch (e) {
      log.error(`sui-packages api error`);
      console.error(e);
    }

    log.info(`dsrvProceed accountID=${accountID}`);
    setDeployedContract(accountID);
    setAtAddress(accountID);
    setInputAddress(accountID);
    initContract(accountID, publishedChange?.packageId, 'address');
    await client.terminal.log({ type: 'info', value: `transaction hash ---> ${txnHash}` });

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
