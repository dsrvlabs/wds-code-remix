import React, { useState } from 'react';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Button, Form as ReactForm } from 'react-bootstrap';
import {
  ChainRestAuthApi,
  ChainGrpcWasmApi,
  BaseAccount,
  createTransaction,
  ChainRestTendermintApi,
  MsgExecuteContract,
  CosmosTxV1Beta1Tx,
  BroadcastModeKeplr,
  TxRaw,
  getTxRawFromTxRawOrDirectSignResponse,
} from '@injectivelabs/sdk-ts';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { getStdFee, BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT } from '@injectivelabs/utils';
import { simulateInjectiveTx } from './injective-helper';
import { SignDoc } from '@keplr-wallet/types';
import { TransactionException } from '@injectivelabs/exceptions';
import { ChainId } from '@injectivelabs/ts-types';
import { toBase64, fromBase64 } from '@injectivelabs/sdk-ts';
import { log } from '../../utils/logger';

interface InterfaceProps {
  contractAddress: string;
  providerInstance: any;
  client: any;
  fund: number;
  gasPrice: number;
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  wallet: string;
  providerNetwork: string;
  account: string;
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({
  contractAddress,
  providerInstance,
  client,
  fund,
  gasPrice,
  schemaExec,
  schemaQuery,
  wallet,
  providerNetwork,
  account,
}) => {
  const [queryMsgErr, setQueryMsgErr] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const [executeMsgErr, setExecuteMsgErr] = useState('');
  const [executeResult, setExecuteResult] = useState('');

  const [queryMsg, setQueryMsg] = useState({});
  const [executeMsg, setExecuteMsg] = useState({});

  const executeKeplr = async () => {
    const injAddr = account;

    const chainId = providerNetwork;

    const restEndpoint = getNetworkEndpoints(Network.Testnet).rest;
    const grpcEndpoint = getNetworkEndpoints(Network.Testnet).grpc;
    const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);

    const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injAddr);

    const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);
    const keplrKey = await providerInstance.getKey(chainId);
    const pubkey = Buffer.from(keplrKey.pubKey).toString('base64');
    const keplrInstance = (window as any).keplr;
    const offlineSigner = keplrInstance.getOfflineSigner(chainId);

    const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);
    const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
    const latestHeight = latestBlock.header.height;
    const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);

    const funds = fund ? [{ denom: 'inj', amount: fund.toString() }] : [];
    const executeMsg_ = { ...executeMsg };
    recursiveValueChange(executeMsg_, stringToNumber);

    const msgExecuteContract = MsgExecuteContract.fromJSON({
      contractAddress: contractAddress,
      sender: injAddr,
      msg: executeMsg_,
      funds: funds,
    });

    const gasFee = await simulateInjectiveTx(
      grpcEndpoint,
      pubkey,
      chainId,
      msgExecuteContract,
      baseAccount.sequence,
      baseAccount.accountNumber,
    );

    const { signDoc } = createTransaction({
      pubKey: pubkey,
      chainId: chainId,
      fee: getStdFee({ gas: gasFee }),
      message: msgExecuteContract,
      sequence: baseAccount.sequence,
      timeoutHeight: timeoutHeight.toNumber(),
      accountNumber: baseAccount.accountNumber,
    });

    const directSignResponse = await offlineSigner.signDirect(
      injAddr,
      signDoc as unknown as SignDoc,
    );

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
    const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);

    const txHash = await broadcastTx(ChainId.Testnet, txRaw);
    await client.terminal.log({ type: 'info', value: `Execute Contract transaction hash : ${txHash}` });
  };

  const queryKeplr = async () => {
    const grpcEndpoint = getNetworkEndpoints(Network.Testnet).grpc;
    const chainGrpcWasmApiClient = new ChainGrpcWasmApi(grpcEndpoint);
    try {
      const response = (await chainGrpcWasmApiClient.fetchSmartContractState(
        contractAddress, // The address of the contract
        toBase64({ get_count: {} }),
      )) as unknown as { data: string };
      const { count } = fromBase64(response.data);
      setQueryResult(count);
    } catch (e: any) {
      log.debug('error', e);
      setQueryResult(e?.message);
      await client.terminal.log({ type: 'error', value: e?.message?.toString() });
    }
  };

  const handleQueryChange = ({ formData }: any) => {
    setQueryMsg(formData);
  };

  const handleExecuteChange = ({ formData }: any) => {
    setExecuteMsg(formData);
  };

  const generateUiSchemaFromSchema = (schema: any) => {
    if (schema.oneOf) {
      const enumOptions = schema.oneOf.map((obj: any, key: any) => {
        const lbl = Object.keys(obj.properties)[0];
        return { value: key, label: lbl };
      });
      return {
        'ui:widget': 'select',
        'ui:options': { enumOptions },
        classNames: 'no-legend',
      };
    }
    return {};
  };

  const uiSchemaQuery = generateUiSchemaFromSchema(schemaQuery);
  const uiSchemaExecute = generateUiSchemaFromSchema(schemaExec);

  return (
    <div>
      <ReactForm>
        <ReactForm.Group>
          <div
            style={{ display: 'flex', alignItems: 'center', margin: '0.3em 0.3em' }}
            className="mb-2"
          >
            <Form
              schema={schemaQuery}
              validator={validator}
              uiSchema={uiSchemaQuery}
              onChange={handleQueryChange}
              formData={queryMsg || {}}
            >
              <Button onClick={queryKeplr} size={'sm'}>
                Query
              </Button>
            </Form>
          </div>
          <div>
            <span style={{ color: 'red' }}>{queryMsgErr}</span>
          </div>
          <div>
            <span style={{ color: 'green' }}>{queryResult}</span>
          </div>
        </ReactForm.Group>
        <hr />
        <ReactForm.Group>
          <div
            style={{ display: 'flex', alignItems: 'center', margin: '0.3em 0.3em' }}
            className="mb-2"
          >
            <Form
              schema={schemaExec}
              validator={validator}
              uiSchema={uiSchemaExecute}
              onChange={handleExecuteChange}
              formData={executeMsg || {}}
            >
              <Button onClick={executeKeplr} size={'sm'}>
                Execute
              </Button>
            </Form>
          </div>
          <div>
            <span style={{ color: 'red' }}>{executeMsgErr}</span>
          </div>
        </ReactForm.Group>
      </ReactForm>
    </div>
  );
};

function recursiveValueChange(obj: any, callback: any) {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      recursiveValueChange(obj[key], callback);
    } else {
      obj[key] = callback(obj[key]);
    }
  }
}

function stringToNumber(value: any) {
  if (!isNaN(value) && typeof value === 'string' && value.trim() !== '') {
    return parseFloat(value);
  }
  return value;
}
