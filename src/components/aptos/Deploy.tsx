import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  codeBytes,
  dappTxn,
  getAccountResources,
  getTx,
  metadataSerializedBytes,
  shortHex,
  waitForTransactionWithResult,
} from './aptos-helper';

import copy from 'copy-to-clipboard';
import { isNotEmptyList } from '../../utils/ListUtil';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { ModuleWrapper } from './Compiler';
import { Types } from 'aptos';
export interface AptosDeployHistoryCreateDto {
  chainId: string;
  account: string;
  package: string;
  compileTimestamp: number;
  deployTimestamp: number;
  upgradeNumber: string | null;
  upgradePolicy: number | null;
  txHash: string;
  modules: string[];
}

interface InterfaceProps {
  wallet: string;
  accountID: string;
  compileTimestamp: string;
  packageName: string;
  moduleWrappers: ModuleWrapper[];
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
  estimatedGas?: string;
  setEstimatedGas: Function;
  gasUnitPrice: string;
  setGasUnitPrice: Function;
  maxGasAmount: string;
  setMaxGasAmount: Function;
}

interface WriteResourcePackageModule {
  name: string;
}

interface WriteResourcePackage {
  name: string;
  upgrade_number: string;
  upgrade_policy: {
    policy: number;
  };
  modules: WriteResourcePackageModule[];
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  compileTimestamp,
  packageName,
  moduleWrappers,
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
  estimatedGas,
  setEstimatedGas,
  gasUnitPrice,
  setGasUnitPrice,
  maxGasAmount,
  setMaxGasAmount,
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
      const rawTx_ = await dappTxn(
        accountID,
        dapp.networks.aptos.chain,
        '0x1::code',
        'publish_package_txn',
        [],
        [metadataSerializedBytes(metaData64), codeBytes(moduleBase64s)],
        dapp,
        gasUnitPrice,
        maxGasAmount,
      );

      const txnHash = await dapp.request('aptos', {
        method: 'dapp:signAndSendTransaction',
        params: [rawTx_],
      });
      log.debug(`@@@ txnHash=${txnHash}`);

      const result = (await waitForTransactionWithResult(
        txnHash,
        dapp.networks.aptos.chain,
      )) as any;
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

        const tx: Types.Transaction_UserTransaction = (await getTx(
          txnHash,
          dapp.networks.aptos.chain,
        )) as Types.Transaction_UserTransaction;

        const change = tx.changes.find((change) => {
          const change_: Types.WriteSetChange_WriteResource =
            change as Types.WriteSetChange_WriteResource;
          return (
            change_.address === shortHex(accountID) &&
            change_.type === 'write_resource' &&
            change_.data.type === '0x1::code::PackageRegistry'
          );
        });
        const change_: Types.WriteSetChange_WriteResource =
          change as Types.WriteSetChange_WriteResource;

        const data = change_.data.data as any;
        const writeResourcePackages = data.packages as WriteResourcePackage[];
        const writeResourcePackage = writeResourcePackages.find((pkg) => pkg.name === packageName);
        console.log(`writeResourcePackage`, JSON.stringify(writeResourcePackage, null, 2));
        const aptosDeployHistoryCreateDto = {
          chainId: dapp.networks.aptos.chain,
          account: accountID,
          package: packageName,
          compileTimestamp: Number(compileTimestamp),
          deployTimestamp: Number(result.timestamp),
          upgradeNumber: writeResourcePackage?.upgrade_number,
          upgradePolicy: writeResourcePackage?.upgrade_policy.policy,
          txHash: result.hash,
          modules: writeResourcePackage?.modules.map((m) => m.name),
        };
        console.log(
          `aptosDeployHistoryCreateDto`,
          JSON.stringify(aptosDeployHistoryCreateDto, null, 2),
        );

        const res = await axios.post(
          COMPILER_API_ENDPOINT + '/aptos-deploy-histories',
          aptosDeployHistoryCreateDto,
        );

        log.info(`aptos-deploy-histories api res`, res);

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
