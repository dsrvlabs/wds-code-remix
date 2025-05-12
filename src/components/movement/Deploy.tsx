import React, { useState } from 'react';
import { Button, Alert, Spinner } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  getAccountResources,
  getNetworkInfo,
  getTx,
  shortHex,
  waitForTransactionWithResult,
} from './movement-helper';

import { Aptos, Network, AptosConfig } from '@aptos-labs/ts-sdk';
import { HexString } from 'aptos';

import copy from 'copy-to-clipboard';
import { isNotEmptyList } from '../../utils/ListUtil';
import { ModuleWrapper } from './Compiler';
import { Types } from 'aptos';
import { MovementGitDependency } from 'wds-event';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';

export interface MovementDeployHistoryCreateDto {
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
  cliVersion: string | null;
  movementGitDependencies: MovementGitDependency[];
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
  cliVersion,
  movementGitDependencies,
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
  const [deployIconSpin, setDeployIconSpin] = useState<string>('fa-spin');
  const [abi, setABI] = useState<any>({});
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');
  const [deploymentError, setDeploymentError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [copyTxMsg, setCopyTxMsg] = useState<string>('Copy');

  const checkExistContract = async () => {
    if (!dapp) {
      throw new Error('Wallet is not installed');
    }

    if (!accountID) {
      throw new Error('No account address provided');
    }

    if (!(metaData64 && moduleBase64s.length > 0)) {
      throw new Error('Metadata or modules are not prepared');
    }

    await nightlyProceed();
  };

  const nightlyProceed = async () => {
    try {
      setInProgress(true);
      setDeployIconSpin('fa-spin');
      setDeploymentStatus('preparing');
      setDeploymentError('');

      const network = dapp.networks.movement.chain;

      // Movement network information
      const networkInfo = getNetworkInfo(network);

      // Aptos client setup
      const config = new AptosConfig({
        network: networkInfo.name,
        fullnode: networkInfo.url,
      });
      const aptos = new Aptos(config);

      // Nightly wallet connection
      const adaptor = window.nightly?.aptos;
      if (!adaptor) {
        throw new Error('Wallet connection failed');
      }

      // Wallet connection
      await adaptor.features['aptos:connect'].connect(true, networkInfo);
      const accountInfo = await adaptor.features['aptos:account'].account();

      if (!accountInfo) {
        throw new Error('Could not get account information');
      }

      let txnToSimulate;

      try {
        // Convert data to format compatible with publishPackageTransaction
        const convertedMetadataBytes = new HexString(
          Buffer.from(metaData64, 'base64').toString('hex'),
        ).toUint8Array();

        const convertedModuleBytecodes = moduleBase64s.map((module) =>
          new HexString(Buffer.from(module, 'base64').toString('hex')).toUint8Array(),
        );
        // const convertedModuleBytecodes = codeBytes(moduleBase64s);

        // Create transaction
        txnToSimulate = await aptos.publishPackageTransaction({
          account: accountInfo.address,
          metadataBytes: convertedMetadataBytes,
          moduleBytecode: convertedModuleBytecodes,
        });

        // Transaction simulation
        const [simulationResult] = await aptos.transaction.simulate.simple({
          signerPublicKey: accountInfo.publicKey,
          transaction: txnToSimulate,
        });

        if (!simulationResult.success) {
          throw new Error(`Simulation failed: ${simulationResult.vm_status}`);
        }

        // Set estimated gas
        if (simulationResult.gas_used) {
          setEstimatedGas(simulationResult.gas_used.toString());
        }

        // Sign and submit transaction with wallet
        const signAndSubmit = adaptor.features['aptos:signAndSubmitTransaction'];
        if (!signAndSubmit) {
          throw new Error('Transaction signing feature is not available');
        }

        const result = await signAndSubmit.signAndSubmitTransaction({
          payload: {
            function: '0x1::code::publish_package_txn',
            typeArguments: [],
            functionArguments: [convertedMetadataBytes, convertedModuleBytecodes],
          },
        });

        // Check transaction response type
        type TransactionResponse = {
          hash: string;
        };

        if (result && typeof result === 'object' && 'hash' in result) {
          const txResponse = result as TransactionResponse;
          const txHash = txResponse.hash;
          setTxHash(txHash);

          // Wait for transaction completion
          const txResult = (await waitForTransactionWithResult(
            txHash,
            network,
          )) as Types.UserTransaction;
          log.info('Transaction result:', txResult);

          if ('success' in txResult && txResult.success) {
            await client.terminal.log({
              type: 'info',
              value: {
                hash: txResult.hash,
                success: txResult.success,
                vm_status: txResult.vm_status,
                gas_used: txResult.gas_used,
                sender: txResult.sender,
                sequence_number: txResult.sequence_number,
                timestamp: txResult.timestamp,
              },
            });

            setDeploymentStatus('success');

            // Get detailed transaction information for package registry
            const tx: Types.Transaction_UserTransaction = (await getTx(
              txHash,
              network,
            )) as Types.Transaction_UserTransaction;

            // Find the package registry change in transaction
            const change = tx.changes.find((change) => {
              const change_: Types.WriteSetChange_WriteResource =
                change as Types.WriteSetChange_WriteResource;
              return (
                change_.address === shortHex(accountID) &&
                change_.type === 'write_resource' &&
                change_.data.type === '0x1::code::PackageRegistry'
              );
            });

            if (change) {
              const change_: Types.WriteSetChange_WriteResource =
                change as Types.WriteSetChange_WriteResource;

              const data = change_.data.data as any;
              const writeResourcePackages = data.packages as WriteResourcePackage[];
              const writeResourcePackage = writeResourcePackages.find(
                (pkg) => pkg.name === packageName,
              );

              // Create and save deployment history
              const movementDeployHistoryCreateDto = {
                chainId: network,
                account: accountID,
                package: packageName,
                compileTimestamp: Number(compileTimestamp),
                deployTimestamp: Number(txResult.timestamp),
                upgradeNumber: writeResourcePackage?.upgrade_number,
                upgradePolicy: writeResourcePackage?.upgrade_policy.policy,
                cliVersion: cliVersion,
                movementGitDependencies: movementGitDependencies,
                txHash: txResult.hash,
                modules: writeResourcePackage?.modules.map((m) => m.name),
              };

              try {
                const res = await axios.post(
                  COMPILER_API_ENDPOINT + '/movement-deploy-histories',
                  movementDeployHistoryCreateDto,
                );
                console.log('@@@ res', res);
                log.info('Movement deploy histories API response:', res);
              } catch (apiError) {
                log.error('Failed to save deployment history:', apiError);
              }
            }

            setDeployedContract(accountID || '');
            setAtAddress(accountID || '');

            // Update account resources
            const moveResources = await getAccountResources(accountID || '', network);
            log.info('Account resources:', moveResources);
            setAccountResources([...moveResources]);

            if (isNotEmptyList(moveResources)) {
              setTargetResource(moveResources[0].type);
            } else {
              setTargetResource('');
            }
            setParameters([]);

            // Get module information
            getAccountModulesFromAccount(accountID || '', network);

            log.info('Transaction execution successful');
          } else {
            const errorMsg = 'vm_status' in txResult ? txResult.vm_status : 'Unknown error';
            log.error(errorMsg);
            await client.terminal.log({
              type: 'error',
              value: errorMsg,
            });
            throw new Error(`Transaction failed: ${errorMsg}`);
          }
        } else {
          throw new Error('Transaction signing was rejected or failed');
        }
      } catch (e) {
        log.error(e);
        setDeploymentStatus('error');
        setDeploymentError(e instanceof Error ? e.message : 'An unknown error occurred');
        await client.terminal.log({
          type: 'error',
          value: e instanceof Error ? e.message : 'An unknown error occurred',
        });
      }
    } catch (e) {
      log.error(e);
      setDeploymentStatus('error');
      setDeploymentError(e instanceof Error ? e.message : 'An unknown error occurred');
      await client.terminal.log({
        type: 'error',
        value: e instanceof Error ? e.message : 'An unknown error occurred',
      });
    } finally {
      setInProgress(false);
      setDeployIconSpin('');
    }
  };

  const getStatusMessage = () => {
    switch (deploymentStatus) {
      case 'preparing':
        return 'Preparing Move contract deployment...';
      case 'connecting':
        return 'Connecting to Nightly wallet... Please check your wallet extension.';
      case 'signing':
        return 'Waiting for transaction signing... Please confirm the transaction in your wallet.';
      case 'confirming':
        return 'Confirming transaction... (This process may take a few minutes depending on network conditions)';
      case 'success':
        return 'Contract deployment successful! You can now interact with the contract.';
      case 'error':
        return 'Error occurred: ' + deploymentError;
      default:
        return '';
    }
  };

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
              setDeploymentStatus('error');
              setDeploymentError(e instanceof Error ? e.message : 'An unknown error occurred');
            }
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span>
            {inProgress ? <i className={`fas fa-spinner ${deployIconSpin}`}></i> : ''} Deploy
          </span>
        </Button>

        {deploymentStatus && (
          <Alert
            variant={
              deploymentStatus === 'error'
                ? 'danger'
                : deploymentStatus === 'success'
                ? 'success'
                : 'info'
            }
            className="mt-2"
          >
            <small>{getStatusMessage()}</small>
            {deploymentStatus === 'confirming' && (
              <div className="text-center mt-2">
                <Spinner animation="border" size="sm" />
              </div>
            )}

            {/* Display estimated gas cost */}
            {estimatedGas && !inProgress && (
              <div className="mt-2">
                <small>
                  Estimated gas usage: {estimatedGas} units (approx. {parseInt(estimatedGas) * 100}{' '}
                  Octa)
                </small>
              </div>
            )}

            {/* Display transaction hash and copy feature */}
            {txHash && (deploymentStatus === 'confirming' || deploymentStatus === 'success') && (
              <div className="mt-2">
                <small>
                  Transaction hash:{' '}
                  {typeof txHash === 'string'
                    ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}`
                    : txHash}
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-0 pt-0"
                    onClick={() => {
                      copy(txHash);
                      setCopyTxMsg('Copied!');
                    }}
                    onMouseLeave={() => {
                      setTimeout(() => setCopyTxMsg('Copy'), 100);
                    }}
                  >
                    <i className="far fa-copy" /> <small>{copyTxMsg}</small>
                  </Button>
                </small>
              </div>
            )}
          </Alert>
        )}

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
