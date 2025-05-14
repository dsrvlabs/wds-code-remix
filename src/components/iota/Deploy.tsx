import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  dappPublishTxn,
  getProvider,
  IotaChainId,
  waitForTransactionWithResult,
} from './iota-helper';

import copy from 'copy-to-clipboard';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { CompiledModulesAndDeps } from 'wds-event';
import { isEmptyList } from '../../utils/ListUtil';
import { publicKeyFromRawBytes } from '@mysten/sui/verify';

import { Transaction } from '@iota/iota-sdk/transactions';
import { fromB64, normalizeSuiObjectId } from '@mysten/sui/utils';
import { NightlyConnectIotaAdapter } from '@nightlylabs/wallet-selector-iota';

export interface IotaDeployHistoryCreateDto {
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
  setIotaObjects: Function;
  setTargetObjectId: Function;
  setGenericParameters: Function;
  setParameters: Function;
  setInputAddress: Function;
  initContract: Function;
  uploadCodeChecked: boolean;
  blob: Blob | undefined;
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
  setIotaObjects,
  setTargetObjectId,
  setGenericParameters,
  setParameters,
  setInputAddress,
  initContract,
  uploadCodeChecked,
  blob,
}) => {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('');
  const [abi, setABI] = useState<any>({});
  const [param, setParam] = useState<string>('');
  const [resource, setResource] = useState<string>('');

  useEffect(() => {
    // 컴포넌트가 마운트될 때 dapp 객체 검사
    console.log('Deploy 컴포넌트 마운트 - dapp 확인:', dapp);
    console.log('dapp?.request 존재 여부:', typeof dapp?.request === 'function');

    // 추가 디버깅 정보
    if (dapp?.wallet) {
      console.log('dapp.wallet 객체:', dapp.wallet);
      console.log(
        'dapp.wallet 메소들:',
        Object.getOwnPropertyNames(dapp.wallet).filter(
          (prop) => typeof dapp.wallet[prop] === 'function',
        ),
      );
      console.log(
        'dapp.wallet.signAndExecuteTransaction 타입:',
        typeof dapp.wallet.signAndExecuteTransaction,
      );
      if (typeof dapp.wallet.signAndExecuteTransaction === 'function') {
        console.log(
          'signAndExecuteTransaction 함수 문자열:',
          dapp.wallet.signAndExecuteTransaction.toString().substring(0, 150) + '...',
        );
      }
    }
  }, [dapp]);

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
      event_category: 'iota',
      method: 'deploy',
    });

    if (!dapp) {
      return;
    }

    setDeployIconSpin('fa-spin');

    const nightyIota = (window.nightly as any).iota;
    const { accounts } = await nightyIota.connect();

    const tx = new Transaction();
    const [upgradeCap] = tx.publish({
      modules: compiledModulesAndDeps.modules,
      dependencies: compiledModulesAndDeps.dependencies,
    });
    tx.transferObjects([upgradeCap], tx.pure.address(accounts[0].address));
    console.log('Upgrade capability created');

    const txid = await nightyIota.signAndExecuteTransaction({
      transaction: tx,
      chain: 'iota:testnet',
      signer: accounts[0],
    });

    // Extract transaction digest from txid object
    const txHash = txid.digest;

    // Check transaction result
    let result;
    try {
      // Wait for transaction confirmation
      result = await waitForTransactionWithResult([txHash], dapp.networks.iota.chain);
    } catch (e) {
      console.error(e);
      await client.terminal.log({
        type: 'error',
        value: `Failed to get transaction block for ${txHash}`,
      });
      setInProgress(false);
      setDeployIconSpin('');
      return;
    }
    log.info('Transaction result:', result);

    if (result.effects?.status?.status !== 'success') {
      log.error('Transaction failed:', result);
      await client.terminal.log({ type: 'error', value: JSON.stringify(result, null, 2) });
      setInProgress(false);
      setDeployIconSpin('');
      return;
    }

    await client.terminal.log({
      type: 'info',
      value: `-------------------- ${txHash} --------------------`,
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
      log.error(`No published change found.`);
      setInProgress(false);
      setDeployIconSpin('');
      return;
    }

    if (!publishedChange.packageId) {
      log.error(`No package ID found.`, publishedChange);
      setInProgress(false);
      setDeployIconSpin('');
      return;
    }
    const modules = publishedChange.modules || [];

    const iotaDeployHistoryCreateDto: IotaDeployHistoryCreateDto = {
      chainId: dapp.networks.iota.chain,
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
    log.info('iotaDeployHistoryCreateDto', iotaDeployHistoryCreateDto);

    try {
      const res = await axios.post(
        COMPILER_API_ENDPOINT + '/iota-deploy-histories',
        iotaDeployHistoryCreateDto,
      );
      log.info(`iota-deploy-histories API response`, res);
    } catch (e) {
      log.error(`iota-deploy-histories API error`);
      console.error(e);
    }

    try {
      const res = await axios.post(
        COMPILER_API_ENDPOINT + '/iota/packages',
        iotaDeployHistoryCreateDto,
      );
      log.info(`iota-packages API response`, res);

      // if (uploadCodeChecked) {
      //   axios
      //     .post(COMPILER_API_ENDPOINT + '/iota/verifications', {
      //       network: res.data.chainId,
      //       packageId: res.data.packageId,
      //     })
      //     .then((response) => {
      //       console.log('Success (POST /iota/verifications): ', response.data);
      //       if (blob) {
      //         console.log(`Walrus 업로드 시도 중...`);
      //         axios
      //           .put('https://publisher.walrus-testnet.walrus.space/v1/store', blob, {
      //             headers: {
      //               'Content-Type': 'application/octet-stream',
      //             },
      //           })
      //           .then(async (response) => {
      //             console.log(
      //               'Success (PUT https://publisher.walrus-testnet.walrus.space/v1/store): ',
      //               response.data,
      //             );
      //             const result = response.data;
      //             let walrusBlobId;
      //             if (result.newlyCreated?.blobObject?.blobId) {
      //               walrusBlobId = result.newlyCreated.blobObject.blobId;
      //             } else if (result.alreadyCertified?.blobId) {
      //               walrusBlobId = result.alreadyCertified.blobId;
      //             } else {
      //               console.error(`Walrus blobId를 찾을 수 없습니다.`);
      //             }

      //             if (walrusBlobId) {
      //               try {
      //                 const res = await axios.post(COMPILER_API_ENDPOINT + '/sui/walrus-blob-id', {
      //                   chainId: dapp.networks.iota.chain,
      //                   packageId: publishedChange.packageId,
      //                   blobId: walrusBlobId,
      //                 });
      //               } catch (e) {
      //                 console.error(e);
      //               }
      //             }
      //           })
      //           .catch((error) => {
      //             console.error(
      //               'Error (PUT https://publisher.walrus-testnet.walrus.space/v1/store):',
      //               error.response ? error.response.data : error.message,
      //             );
      //           })
      //           .finally(() => {
      //             console.log(
      //               'PUT https://publisher.walrus-testnet.walrus.space/v1/store): Request completed',
      //             );
      //           });
      //       }
      //     })
      //     .catch((error) => {
      //       console.error(
      //         'Error (POST /iota/verifications):',
      //         error.response ? error.response.data : error.message,
      //       );
      //     })
      //     .finally(() => {
      //       console.log('POST /iota/verifications Request completed');
      //     });
      // }
    } catch (e) {
      log.error(`iota-packages API error`);
      console.error(e);
    }

    log.info(`Deployment complete. Account ID=${accountID}`);
    setDeployedContract(accountID);
    setAtAddress(accountID);
    setInputAddress(accountID);
    initContract(accountID, publishedChange?.packageId, 'address');
    await client.terminal.log({ type: 'info', value: `Transaction hash ---> ${txHash}` });

    setInProgress(false);
    setDeployIconSpin('');
  };

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
