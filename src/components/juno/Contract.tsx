import React, { useState } from 'react';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { calculateFee, GasPrice, StargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { log } from '../../utils/logger';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Decimal } from '@cosmjs/math';
import { simulate } from './juno-helper';

interface InterfaceProps {
  contractAddress: string;
  dapp: any;
  client: any;
  fund: number;
  gasPrice: number;
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({
  contractAddress,
  dapp,
  client,
  fund,
  gasPrice,
  schemaExec,
  schemaQuery,
}) => {
  const [queryMsgErr, setQueryMsgErr] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const [executeMsgErr, setExecuteMsgErr] = useState('');
  const [executeResult, setExecuteResult] = useState('');

  const [queryMsg, setQueryMsg] = useState({});
  const [executeMsg, setExecuteMsg] = useState({});

  const execute = async () => {
    setExecuteResult('');

    if (!dapp) {
      return;
    }

    dapp
      .request('juno', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['juno'].address);
        log.debug('publicKey', result['juno'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const cid = dapp.networks.juno.chain;

          let rpcUrl = 'https://uni-rpc.reece.sh/';
          let denom = 'ujunox';
          if (cid === 'juno') {
            rpcUrl = 'https://rpc-juno.itastakers.com';
            denom = 'ujuno';
          }

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const sequence = (await stargateClient.getSequence(result['juno'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await stargateClient.getSequence(result['juno'].address))
            .accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);

          log.debug(contractAddress);

          const funds = fund ? [{ denom, amount: fund.toString() }] : [];

          const execContractMsg = {
            typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
            value: {
              sender: result['juno'].address,
              contract: contractAddress,
              msg: toBase64(toUtf8(JSON.stringify(executeMsg))) as any,
              funds,
            },
          };

          log.debug(JSON.stringify(execContractMsg));

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            [execContractMsg],
            memo,
            result['juno'].pubKey,
            sequence,
          );
          log.debug('@@@ gasEstimation', gasEstimation);
          log.debug('@@@ gasPrice', gasPrice);
          log.debug('@@@ denom', gasEstimation);

          const gas = new GasPrice(Decimal.fromUserInput(gasPrice.toString(), 18), denom);

          // const multiplier = 1.3;
          // const usedFee = calculateFee(Math.round(gasEstimation * multiplier), gas);
          const usedFee = calculateFee(Number(gasEstimation), gas);
          log.debug('@@@ usedFee', usedFee);

          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            fee: usedFee,
            msgs: [execContractMsg],
          };

          log.debug(rawTx);

          const res = await dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });
          setExecuteResult(`transaction hash : ${res[0]}`);
          log.debug(res);
          await client.terminal.log({ type: 'info', value: `transaction hash : ${res[0]}` });
        } catch (error: any) {
          log.error(error);
          await client.terminal.log({ type: 'error', value: error?.message?.toString() });
        }
      });
  };

  // query
  const query = async () => {
    const cid = dapp.networks.juno.chain;

    let rpcUrl = 'https://uni-rpc.reece.sh/';
    if (cid === 'juno') {
      rpcUrl = 'https://rpc-juno.itastakers.com';
    }
    const cosmwasmClient = await SigningCosmWasmClient.connect(rpcUrl);

    try {
      const res = await cosmwasmClient.queryContractSmart(contractAddress, queryMsg);
      log.debug(res);
      setQueryResult(JSON.stringify(res, null, 2));
      await client.terminal.log({ type: 'info', value: res });
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
            <Button onClick={query} size={'sm'}>
              Query
            </Button>
          </Form>
        </div>
        <div>
          <span style={{ color: 'red' }}>{queryMsgErr}</span>
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
            <Button onClick={execute} size={'sm'}>
              Execute
            </Button>
          </Form>
        </div>
        <div>
          <span style={{ color: 'red' }}>{executeMsgErr}</span>
        </div>
      </ReactForm.Group>
    </ReactForm>
  );
};
