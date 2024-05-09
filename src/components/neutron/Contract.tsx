import React, { useState } from 'react';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { calculateFee, GasPrice, StargateClient, SigningStargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { log } from '../../utils/logger';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Decimal } from '@cosmjs/math';
import { simulate } from './neutron-helper';
import { Registry } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';

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

  const execute = async () => {
    setExecuteResult('');
    if (!providerInstance) return;
  
    try {
      if (wallet === 'Welldone') {
        await executeWelldone();
      } else if (wallet === 'Keplr') {
        await executeKeplr();
      }
    } catch (error: any) {
      log.error(error);
      setExecuteResult(`Error: ${error.message}`);
    }
  };

  const executeWelldone = async () => {
    setExecuteResult('');

    if (!providerInstance) {
      return;
    }

    providerInstance
      .request('neutron', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['neutron'].address);
        log.debug('publicKey', result['neutron'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const cid = providerInstance.networks.neutron.chain;

          let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
          // let rpcUrl = 'https://neutron-node.welldonestudio.io/';

          let denom = 'untrn';
          if (cid === 'mainnet') {
            rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
            denom = 'untrn';
          }

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const sequence = (await stargateClient.getSequence(result['neutron'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await stargateClient.getSequence(result['neutron'].address))
            .accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);

          log.debug(contractAddress);

          const funds = fund ? [{ denom, amount: fund.toString() }] : [];

          log.debug(`!!! executeMsg=${JSON.stringify(executeMsg, null, 2)}`);
          const executeMsg_ = { ...executeMsg };
          recursiveValueChange(executeMsg_, stringToNumber);

          const execContractMsg = {
            typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
            value: {
              sender: result['neutron'].address,
              contract: contractAddress,
              msg: toBase64(toUtf8(JSON.stringify(executeMsg_))) as any,
              funds: funds,
            },
          };

          log.debug(JSON.stringify(execContractMsg));

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            [execContractMsg],
            memo,
            result['neutron'].pubKey,
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

          const res = await providerInstance.request('neutron', {
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

  const bufferToHex = (buffer: ArrayBuffer): string => {
    const view = new DataView(buffer);
    let hexStr = '';
  
    for (let i = 0; i < view.byteLength; i++) {
      const byte = view.getUint8(i);
      const hex = byte.toString(16).padStart(2, '0');
      hexStr += hex;
    }
  
    return hexStr;
  }

  const executeKeplr = async () => {
    const rpcUrl = providerNetwork === 'neutron-1'
      ? 'https://rpc-kralum.neutron-1.neutron.org'
      : 'https://rpc-palvus.pion-1.ntrn.tech/';
    const denom = 'untrn';
  
    const stargateClient = await StargateClient.connect(rpcUrl);
    const offlineSigner = providerInstance.getOfflineSigner(providerNetwork);

    let chainid = providerNetwork;
    log.debug('chainid', chainid);

    let pubkey = await providerInstance.getEnigmaPubKey(chainid);
    log.debug('pubkey', bufferToHex(pubkey.buffer));

    const response = await stargateClient.getSequence(account);
    const chainId = providerNetwork;
  
    const funds = fund ? [{ denom, amount: fund.toString() }] : [];
    const executeMsg_ = { ...executeMsg };
    recursiveValueChange(executeMsg_, stringToNumber);

    console.log(executeMsg_)

    const execContractMsg = {
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: {
        sender: account,
        contract: contractAddress,
        msg: toBase64(toUtf8(JSON.stringify(executeMsg_))) as any,
        funds: funds,
      },
    };
  
    const memo = undefined;
    const gasEstimation = await simulate(
      stargateClient,
      [execContractMsg],
      memo,
      bufferToHex(pubkey.buffer),
      response.sequence
    );
      
    const gas = new GasPrice(Decimal.fromUserInput(gasPrice.toString(), 18), denom);
    const multiplier = 1.3;
    const usedFee = calculateFee(Math.round(Number(gasEstimation) * multiplier), gas);
    // const usedFee = calculateFee(Number(gasEstimation), gas);

    // MsgInstantiateContract
    const registry = new Registry();
    registry.register('/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract);

    const signingClient = await SigningStargateClient.connectWithSigner(rpcUrl, offlineSigner, {registry});
    try{
      const res = await signingClient.signAndBroadcast(account, [execContractMsg], usedFee);
      setExecuteResult(`Transaction hash: ${res.transactionHash}`);
      log.debug(res.transactionHash);
      await client.terminal.log({ type: 'info', value: `transaction hash : ${res.transactionHash}` });
    } catch (error: any) {
      log.error(error);
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
  };

  const query = async () => {
    try {
      if (wallet === 'Welldone') {
        await queryWelldone();
      } else if (wallet === 'Keplr') {
        await queryKeplr();
      }
    } catch (e: any) {
      setQueryResult(`Error: ${e.message}`);
    }
  };

  // query
  const queryWelldone = async () => {
    const cid = providerInstance.networks.neutron.chain;

    let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
    // let rpcUrl = 'https://neutron-node.welldonestudio.io/';

    if (cid === 'mainnet') {
      rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
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

  const queryKeplr = async () => {
    const rpcUrl = providerNetwork === 'neutron-1'
      ? 'https://rpc-kralum.neutron-1.neutron.org'
      : 'https://rpc-palvus.pion-1.ntrn.tech/';
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

function recursiveValueChange(obj: any, callback: any) {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      recursiveValueChange(obj[key], callback);
    } else {
      obj[key] = callback(obj[key]);
    }
  }
}

// function ntos(value: any) {
//   if (typeof value === 'number') return value.toString();
//   return value;
// }

function stringToNumber(value: any) {
  if (!isNaN(value) && typeof value === 'string' && value.trim() !== '') {
    return parseFloat(value);
  }
  return value;
}