import React, { useState } from 'react';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { ChainGrpcWasmApi, MsgExecuteContract } from '@injectivelabs/sdk-ts';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ChainId } from '@injectivelabs/ts-types';
import { toBase64, fromBase64 } from '@injectivelabs/sdk-ts';
import { log } from '../../utils/logger';
import { useWalletStore } from './WalletContextProvider';

interface InterfaceProps {
  contractAddress: string;
  client: any;
  fund: number;
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({
  contractAddress,
  client,
  schemaExec,
  fund,
  schemaQuery,
}) => {
  const [queryMsgErr, setQueryMsgErr] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const [executeMsgErr, setExecuteMsgErr] = useState('');
  const [executeResult, setExecuteResult] = useState('');

  const [queryMsg, setQueryMsg] = useState({});
  const [executeMsg, setExecuteMsg] = useState({});
  const { injectiveBroadcastMsg, walletAccount, chainId } = useWalletStore();

  const executeKeplr = async () => {
    try {
      const funds = fund ? [{ denom: 'inj', amount: fund.toString() }] : [];
      const executeMsg_ = { ...executeMsg };
      recursiveValueChange(executeMsg_, stringToNumber);
      const msg = MsgExecuteContract.fromJSON({
        contractAddress: contractAddress,
        sender: walletAccount,
        msg: executeMsg_,
        funds: funds,
      });
      const txResult = await injectiveBroadcastMsg(msg, walletAccount);
      await client.terminal.log({
        type: 'info',
        value: `Execute Contract transaction hash : ${txResult!.txHash}`,
      });
    } catch (error: any) {
      setExecuteMsgErr(error.message.toString());
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
  };

  const queryKeplr = async () => {
    const grpcEndpoint = getNetworkEndpoints(
      chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    ).grpc;

    const queryMsg_ = { ...queryMsg };
    recursiveValueChange(queryMsg_, stringToNumber);
    const chainGrpcWasmApiClient = new ChainGrpcWasmApi(grpcEndpoint);
    try {
      const response = (await chainGrpcWasmApiClient.fetchSmartContractState(
        contractAddress, // The address of the contract
        toBase64(queryMsg_),
      )) as unknown as { data: string };
      console.log(fromBase64(response.data));
      const queryResult = fromBase64(response.data);
      setQueryResult(JSON.stringify(queryResult));
    } catch (error: any) {
      log.debug('error', error);
      setQueryMsgErr(error.message.toString());
      await client.terminal.log({ type: 'error', value: error.message.toString() });
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
          <div>
            <span style={{ color: 'green' }}>{executeResult}</span>
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
