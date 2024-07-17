import React, { Dispatch, useEffect, useState } from 'react';
import {
  ChainRestAuthApi,
  BaseAccount,
  createTransaction,
  ChainRestTendermintApi,
  TxRestClient,
  CosmosTxV1Beta1Tx,
  BroadcastModeKeplr,
  getTxRawFromTxRawOrDirectSignResponse,
  TxRaw,
  MsgInstantiateContract,
  MsgMigrateContract,
  TxGrpcApi,
} from '@injectivelabs/sdk-ts';
import { ChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { getStdFee, BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT } from '@injectivelabs/utils';
import { TransactionException } from '@injectivelabs/exceptions';
import { SignDoc } from '@keplr-wallet/types';
import { log } from '../../utils/logger';
import { simulateInjectiveTx } from './injective-helper';
import { INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT } from '../../const/endpoint';
import axios from 'axios';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { CustomTooltip } from '../common/CustomTooltip';

import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Contract } from './Contract';

interface InterfaceProps {
  providerInstance: any;
  wallet: string;
  codeID: string;
  client: any;
  setCodeID: Dispatch<React.SetStateAction<string>>;
  fund: number;
  gasPrice: number;
  schemaInit: { [key: string]: any };
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  account: string;
  timestamp: string;
  checksum: string;
  providerNetwork: string;
}

export interface InjectiveDeployHistoryCreateDto {
  chainId: string;
  account: string;
  codeId: string;
  contractAddress: string;
  checksum: string | null;
  compileTimestamp: number | null;
  deployTimestamp: number | null;
  txHash: string;
  isSrcUploaded: boolean;
  createdBy: string;
}

export const Instantiate: React.FunctionComponent<InterfaceProps> = ({
  client,
  providerInstance,
  codeID,
  setCodeID,
  fund,
  gasPrice,
  schemaInit,
  schemaExec,
  schemaQuery,
  account,
  timestamp,
  checksum,
  wallet,
  providerNetwork,
}) => {
  const [initMsgErr, setInitMsgErr] = useState('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [param, setParams] = useState({});
  const [callMsg, setCallMsg] = useState<string>('Instantiate');
  const [immutableChecked, setImmutableChecked] = useState(false);
  const [migrateContractAddress, setMigrateContractAddress] = useState<string>('');
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    setContractAddress('');
    setCallMsg('Instantiate');
  }, [codeID]);

  useEffect(() => {
    setParams({});
  }, [schemaInit]);

  const instantiateKeplr = async () => {
    const grpcEndpoint =
      providerNetwork === 'injective-1'
        ? getNetworkEndpoints(Network.Mainnet).grpc
        : getNetworkEndpoints(Network.Testnet).grpc;
    const injAddr = account;
    const chainId = providerNetwork;
    const restEndpoint =
      providerNetwork === 'injective-1'
        ? getNetworkEndpoints(Network.Mainnet).rest
        : getNetworkEndpoints(Network.Testnet).rest;
    const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injAddr);
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);
    const pubkey = Buffer.from((await providerInstance.getKey(chainId)).pubKey).toString('base64');
    const offlineSigner = providerInstance.getOfflineSigner(chainId);

    const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);
    const funds = fund ? { denom: 'inj', amount: fund.toString() } : undefined;

    const msg = MsgInstantiateContract.fromJSON({
      sender: injAddr,
      admin: immutableChecked ? '' : account,
      codeId: parseInt(codeID),
      label: 'contract init',
      msg: param,
      amount: funds,
    });
    const gasFee = await simulateInjectiveTx(
      grpcEndpoint,
      pubkey,
      chainId,
      msg,
      baseAccount.sequence,
      baseAccount.accountNumber,
    );
    const { signDoc } = createTransaction({
      pubKey: pubkey,
      chainId: chainId,
      fee: getStdFee({ gas: 3000000 }),
      message: msg,
      sequence: baseAccount.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: baseAccount.accountNumber,
    });

    const directSignResponse = await offlineSigner.signDirect(
      injAddr,
      signDoc as unknown as SignDoc,
    );
    const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);
    const broadcastTx = async (chainId: String, txRaw: TxRaw) => {
      const result = await providerInstance.sendTx(
        chainId,
        CosmosTxV1Beta1Tx.TxRaw.encode(txRaw).finish(),
        BroadcastModeKeplr.Sync,
      );

      if (!result || result.length === 0) {
        throw new TransactionException(new Error('Transaction failed to be broadcasted'), {
          contextModule: 'Keplr',
        });
      }

      return Buffer.from(result).toString('hex');
    };
    const txHash = await broadcastTx(ChainId.Testnet, txRaw);
    const contract = await getContract(txHash);
    if (contract) {
      const injectiveDeployHistoryCreateDto: InjectiveDeployHistoryCreateDto = {
        chainId,
        account: account,
        codeId: codeID,
        contractAddress: contract as string,
        compileTimestamp: Number(timestamp),
        deployTimestamp: null, // todo
        txHash: txHash,
        checksum: checksum,
        isSrcUploaded: true, // todo
        createdBy: 'REMIX',
      };
      try {
        const res = await axios.post(
          `${INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT}/deploy-histories`,
          injectiveDeployHistoryCreateDto,
        );
        log.info(`deploy-histories API response:`, res);
      } catch (e) {
        log.error(`deploy-histories API error`);
      }
    }
    log.debug('Contract address:', contract);
    setContractAddress(contract as any);
    setDisabled(true);
    await client.terminal.log({ type: 'info', value: `Contract address is ${contract}` });
  };

  const migrateKeplr = async () => {
    const injAddr = account;
    const chainId = providerNetwork;
    const grpcEndpoint =
      providerNetwork === 'injective-1'
        ? getNetworkEndpoints(Network.Mainnet).grpc
        : getNetworkEndpoints(Network.Testnet).grpc;
    const chainRestAuthApi = new ChainRestAuthApi(grpcEndpoint);
    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injAddr);
    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);
    const pubkey = Buffer.from(await providerInstance.getKey(chainId).pubKey).toString('base64');
    const offlineSigner = providerInstance.getOfflineSigner(chainId);

    const chainRestTendermintApi = new ChainRestTendermintApi(grpcEndpoint);
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);

    const msg = MsgMigrateContract.fromJSON({
      sender: account,
      contract: contractAddress,
      codeId: parseInt(codeID),
      msg: { new_format: 'new format description' },
    });

    const gasFee = await simulateInjectiveTx(
      grpcEndpoint,
      pubkey,
      chainId,
      msg,
      baseAccount.sequence,
      baseAccount.accountNumber,
    );
    const { signDoc } = createTransaction({
      pubKey: pubkey,
      chainId: chainId,
      fee: getStdFee({ gas: gasFee }),
      message: msg,
      sequence: baseAccount.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: baseAccount.accountNumber,
    });

    const directSignResponse = await offlineSigner.signDirect(
      injAddr,
      signDoc as unknown as SignDoc,
    );
    const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);
    console.log(txRaw);
    const broadcastTx = async (chainId: String, txRaw: TxRaw) => {
      const result = await providerInstance.sendTx(
        chainId,
        CosmosTxV1Beta1Tx.TxRaw.encode(txRaw).finish(),
        BroadcastModeKeplr.Sync,
      );

      if (!result || result.length === 0) {
        throw new TransactionException(new Error('Transaction failed to be broadcasted'), {
          contextModule: 'Keplr',
        });
      }

      return Buffer.from(result).toString('hex');
    };
    const txHash = await broadcastTx(ChainId.Testnet, txRaw);
    console.log(txHash);
    const response = await new TxRestClient(grpcEndpoint).fetchTxPoll(txHash);
    await handleMigrationResponse(txHash, chainId, account);
  };

  const getContract = async (hash: string) => {
    const grpcEndpoint =
      providerNetwork === 'injective-1'
        ? getNetworkEndpoints(Network.Mainnet).grpc
        : getNetworkEndpoints(Network.Testnet).grpc;
    const restEndPoint =
      providerNetwork === 'injective-1'
        ? getNetworkEndpoints(Network.Mainnet).rest
        : getNetworkEndpoints(Network.Testnet).rest;
    const txGrpcClient = new TxGrpcApi(grpcEndpoint);
    const txRestClient = new TxRestClient(restEndPoint);
    return new Promise(async function (resolve) {
      const result = await txRestClient.fetchTxPoll(hash, 30000);
      if (result.code !== 0) {
        log.info(`rawLog=${JSON.stringify(result.events, null, 2)}`);
        setInitMsgErr(JSON.stringify(result.events, null, 2));
        resolve('');
        return;
      }
      let contractAddress;
      if (callMsg === 'Instantiate') {
        const instantiateEvent = result.events!.find((e: any) => e.type === 'instantiate');
        const attr = instantiateEvent?.attributes.find((a: any) => a.key === '_contract_address');
        contractAddress = attr?.value || '';
      } else if (callMsg === 'Migrate') {
        const migrateEvent = result.events!.find((e: any) => e.type === 'migrate');
        const attr = migrateEvent?.attributes.find((a: any) => a.key === '_contract_address');
        contractAddress = attr?.value || '';
      }
      resolve(contractAddress);
    });
  };

  const handleMigrationResponse = async (txHash: string, chainId: string, sender: string) => {
    const contract = await getContract(txHash);
    if (contract) {
      const injectiveDeployHistoryCreateDto: InjectiveDeployHistoryCreateDto = {
        chainId: chainId,
        account: account,
        codeId: codeID,
        contractAddress: contract as string,
        compileTimestamp: Number(timestamp),
        deployTimestamp: null, //todo
        txHash: txHash,
        checksum: checksum,
        isSrcUploaded: true, // todo
        createdBy: 'REMIX',
      };
      try {
        const res = await axios.post(
          INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT + '/deploy-histories',
          injectiveDeployHistoryCreateDto,
        );
        log.info(`deploy-histories api res`, res);
      } catch (e) {
        log.error(`deploy-histories api error`);
      }
    }

    log.debug('contract address', contract);
    setContractAddress(contract as any);
    setDisabled(true);
    await client.terminal.log({ type: 'info', value: `contract address is ${contract}` });
  };
  const changeCodeID = (e: { target: { value: any } }) => {
    setCodeID(e.target.value);
  };

  const changeMigrateContractAddress = (e: { target: { value: any } }) => {
    setMigrateContractAddress(e.target.value);
  };

  const handleChange = ({ formData }: any) => {
    setParams(formData);
  };

  const handleCallMsg = (e: { target: { value: React.SetStateAction<string> } }) => {
    setCallMsg(e.target.value);
  };

  const handleCheckboxChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setImmutableChecked(event.target.checked);
  };

  return (
    <div>
      <ReactForm.Group>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'start',
            margin: '0.3em 0.3em',
          }}
        >
          <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
            Code ID
          </div>
          <ReactForm.Control
            type="number"
            placeholder="code_id"
            size="sm"
            value={codeID}
            onChange={changeCodeID}
            readOnly
          />
        </div>
        <hr />
        <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
          Method
        </div>
        <ReactForm.Control
          className="custom-select"
          as="select"
          value={callMsg}
          onChange={handleCallMsg}
          style={{ marginBottom: '10px' }}
          disabled={disabled}
        >
          <option value={'Instantiate'} key={1}>
            {'instantiate'}
          </option>
          <option value={'Migrate'} key={2}>
            {'migrate'}
          </option>
        </ReactForm.Control>
        {callMsg === 'Instantiate' ? (
          <div className="mb-2 form-check" style={{ marginTop: '10px' }}>
            <input
              type="checkbox"
              className="form-check-input"
              id="uploadCodeCheckbox"
              checked={immutableChecked}
              onChange={handleCheckboxChange}
            />
            <CustomTooltip
              placement="top"
              tooltipId="overlay-ataddresss"
              tooltipText="By checking here, this contract becomes immutable."
            >
              <label
                className="form-check-label"
                htmlFor="immutableCheckbox"
                style={{ verticalAlign: 'top' }}
              >
                Immutable
              </label>
            </CustomTooltip>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'start',
              marginTop: '10px',
            }}
          >
            <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
              Target Contract Address
            </div>
            <ReactForm.Control
              placeholder=""
              size="sm"
              value={migrateContractAddress}
              onChange={changeMigrateContractAddress}
            />
          </div>
        )}

        {codeID && callMsg === 'Instantiate' ? (
          <>
            <div style={{ padding: '0.2em' }}>
              <Form
                schema={schemaInit}
                validator={validator}
                onChange={handleChange}
                formData={param || {}}
              >
                <div>
                  {codeID && (
                    <Button
                      type="submit"
                      variant="warning"
                      onClick={instantiateKeplr}
                      className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
                      disabled={!codeID}
                    >
                      <span>Instantiate</span>
                    </Button>
                  )}
                </div>
              </Form>
              {initMsgErr && (
                <span
                  style={{
                    marginRight: '1em',
                    fontSize: '11px',
                    color: 'red',
                    wordBreak: 'break-all',
                  }}
                  className="mb-1"
                >
                  {initMsgErr}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '0.2em' }}>
              <div>
                {codeID && (
                  <Button
                    type="submit"
                    variant="warning"
                    onClick={migrateKeplr}
                    className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
                    disabled={!codeID}
                  >
                    <span>Migrate</span>
                  </Button>
                )}
              </div>
              {initMsgErr && (
                <span
                  style={{
                    marginRight: '1em',
                    fontSize: '11px',
                    color: 'red',
                    wordBreak: 'break-all',
                  }}
                  className="mb-1"
                >
                  {initMsgErr}
                </span>
              )}
            </div>
          </>
        )}
      </ReactForm.Group>
      <ReactForm.Group>
        {contractAddress && (
          <ReactForm.Label style={{ wordBreak: 'break-all' }} className="my-1">
            Contract Address : {contractAddress}
          </ReactForm.Label>
        )}
      </ReactForm.Group>
      {contractAddress ? (
        <Contract
          contractAddress={contractAddress || ''}
          providerInstance={providerInstance}
          client={client}
          fund={fund}
          gasPrice={gasPrice}
          schemaExec={schemaExec}
          schemaQuery={schemaQuery}
          wallet={wallet}
          providerNetwork={providerNetwork}
          account={account}
        />
      ) : (
        <></>
      )}
    </div>
  );
};
