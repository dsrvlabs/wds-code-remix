import React, { useCallback, useEffect, useState } from 'react';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Button, InputGroup, Form as ReactForm } from 'react-bootstrap';
import {
  ChainGrpcWasmApi,
  MsgExecuteContract,
  spotPriceToChainPriceToFixed,
  spotQuantityToChainQuantityToFixed,
} from '@injectivelabs/sdk-ts';
import Form, { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ChainId } from '@injectivelabs/ts-types';
import { toBase64, fromBase64 } from '@injectivelabs/sdk-ts';
import { log } from '../../utils/logger';
import { useWalletStore } from './WalletContextProvider';
interface InterfaceProps {
  compileTarget: string;
  contractAddress: string;
  client: any;
  fund: number;
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({
  compileTarget,
  contractAddress,
  client,
  schemaExec,
  fund,
  schemaQuery,
}) => {
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const [queryMsgErr, setQueryMsgErr] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const [executeMsgErr, setExecuteMsgErr] = useState('');
  const [executeResult, setExecuteResult] = useState('');

  const [queryMsg, setQueryMsg] = useState<{ [key: string]: any }>({});
  const [executeMsg, setExecuteMsg] = useState<{ [key: string]: any }>({});
  const { injectiveBroadcastMsg, injectiveAddress, chainId } = useWalletStore();

  const executeKeplr = async () => {
    try {
      const funds = fund ? [{ denom: 'inj', amount: fund.toString() }] : [];
      const usdtFunds = [
        {
          denom: 'peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5',
          amount: spotQuantityToChainQuantityToFixed({
            value: fund.toString(),
            baseDecimals: 6,
          }),
        },
      ];

      const executeMsg_ = { ...executeMsg };
      const fixedPrice = spotPriceToChainPriceToFixed({
        value: price,
        baseDecimals: 18,
        quoteDecimals: 6,
      });
      const fixedQuantity = spotQuantityToChainQuantityToFixed({
        value: quantity,
        baseDecimals: 18,
      });

      recursiveValueChange(executeMsg_, stringToNumber);
      const msg = compileTarget.split('/').find((dir) => dir === 'atomic-order-example')
        ? MsgExecuteContract.fromJSON({
            contractAddress: contractAddress,
            sender: injectiveAddress,
            msg: {
              swap_spot: {
                price: spotPriceToChainPriceToFixed({
                  value: price,
                  baseDecimals: 18,
                  quoteDecimals: 6,
                }),
                quantity: spotQuantityToChainQuantityToFixed({
                  value: quantity,
                  baseDecimals: 18,
                }),
              },
            },
            funds: usdtFunds,
          })
        : MsgExecuteContract.fromJSON({
            contractAddress: contractAddress,
            sender: injectiveAddress,
            msg: executeMsg_,
            funds: funds,
          });
      const txResult = await injectiveBroadcastMsg(msg, injectiveAddress);
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

  const generateUiSchemaFromSchema = (schema: any) => {
    if (schema.oneOf) {
      // Create enumOptions from schema.oneOf
      const enumOptions = schema.oneOf.map((obj: any, key: any) => {
        const lbl = Object.keys(obj.properties)[0]; // Use the first property as the label
        return { value: key, label: lbl };
      });

      return {
        'ui:widget': 'select',
        'ui:options': { enumOptions },
        'ui:classNames': 'no-legend',
      };
    }
    return {};
  };

  const handlePriceChange = (e: any) => {
    setPrice(e.target.value);
  };
  const handleQuantityChange = (e: any) => {
    setQuantity(e.target.value);
  };

  const handleExecuteChange = ({ formData }: any) => {
    setExecuteMsg(formData);
  };

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
              uiSchema={generateUiSchemaFromSchema(schemaQuery)}
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
          <div className="mb-2">
            {compileTarget.split('/').find((dir) => dir === 'atomic-order-example') ? (
              <ReactForm>
                <ReactForm.Text className="text-muted" style={{ marginBottom: '4px' }}>
                  <small>Price</small>
                </ReactForm.Text>
                <InputGroup>
                  <ReactForm.Control
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={handlePriceChange}
                    size="sm"
                  />
                  <ReactForm.Control type="text" placeholder="" value={'USDT'} size="sm" readOnly />
                </InputGroup>
                <ReactForm.Text className="text-muted" style={{ marginBottom: '4px' }}>
                  <small>Quantity</small>
                </ReactForm.Text>
                <InputGroup>
                  <ReactForm.Control
                    type="number"
                    placeholder="0"
                    value={quantity}
                    onChange={handleQuantityChange}
                    size="sm"
                  />
                </InputGroup>
                <Button onClick={executeKeplr} size={'sm'}>
                  Execute
                </Button>
              </ReactForm>
            ) : (
              <Form
                schema={schemaExec}
                validator={validator}
                uiSchema={uiSchemaExecute}
                onChange={handleExecuteChange}
                formData={executeMsg || {}}
                experimental_defaultFormStateBehavior={{
                  mergeDefaultsIntoFormData: 'useDefaultIfFormDataUndefined',
                }}
              >
                <Button onClick={executeKeplr} size={'sm'}>
                  Execute
                </Button>
              </Form>
            )}
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
