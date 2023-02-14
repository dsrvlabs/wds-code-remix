import React, { Dispatch, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { calculateFee, defaultRegistryTypes, GasPrice, StargateClient } from '@cosmjs/stargate';
import { Instantiate } from './Instantiate';

import {
  MsgClearAdmin,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateAdmin,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';
import { GeneratedType, Registry } from '@cosmjs/proto-signing';
import { Decimal } from '@cosmjs/math';

export const wasmTypes: ReadonlyArray<[string, GeneratedType]> = [
  ['/cosmwasm.wasm.v1.MsgClearAdmin', MsgClearAdmin],
  ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract],
  ['/cosmwasm.wasm.v1.MsgMigrateContract', MsgMigrateContract],
  ['/cosmwasm.wasm.v1.MsgStoreCode', MsgStoreCode],
  ['/cosmwasm.wasm.v1.MsgInstantiateContract', MsgInstantiateContract],
  ['/cosmwasm.wasm.v1.MsgUpdateAdmin', MsgUpdateAdmin],
];

interface InterfaceProps {
  dapp: any;
  wallet: string;
  compileTarget: string;
  client: any;
  wasm: string;
  setWasm: Dispatch<React.SetStateAction<string>>;
  txHash: string;
  setTxHash: Dispatch<React.SetStateAction<string>>;
  codeID: string;
  setCodeID: Dispatch<React.SetStateAction<string>>;
}

export const StoreCode: React.FunctionComponent<InterfaceProps> = ({
  wasm,
  wallet,
  client,
  txHash,
  setTxHash,
  codeID,
  setCodeID,
}) => {
  const waitGetCodeID = async (hash: string) => {
    const rpcUrl = 'https://uni-rpc.reece.sh/';
    const stargateClient = await StargateClient.connect(rpcUrl);

    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const result = await stargateClient.getTx(hash);
        log.debug('!!! waitGetCodeID interval', result);
        if (result) {
          const code_id = JSON.parse(result.rawLog)[0].events[1].attributes[1].value;
          log.debug(code_id);
          // const code_id = result.logs? result.logs[0].events[1].attributes[1].value : ''
          clearInterval(id);
          resolve(code_id);
        }
      }, 4000);
    });
  };

  const dsrvProceed = async () => {
    const dapp = (window as any).dapp;

    if (!dapp) {
      return;
    }

    // wasm이 없을 경우 현재 프로젝트 경로의 wasm 파일 읽어오도록
    if (!wasm) {
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
          const rpcUrl = 'https://uni-rpc.reece.sh/';

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const sequence = (await stargateClient.getSequence(result['juno'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await stargateClient.getSequence(result['juno'].address))
            .accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);

          // const compressed = pako.gzip((wasm), { level: 9 });

          const messages = [
            {
              typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
              value: MsgStoreCode.fromPartial({
                sender: result['juno'].address,
                wasmByteCode: wasm as any,
              }),
            },
          ];

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            messages,
            memo,
            result['juno'].pubKey,
            sequence,
          );
          log.debug('@@@ gasEstimation', gasEstimation);

          const gasPrice = new GasPrice(Decimal.fromUserInput('0.0025', 18), 'ujunox');
          const multiplier = 1.3;
          const usedFee = calculateFee(Math.round(gasEstimation * multiplier), gasPrice);
          log.debug('@@@ usedFee', usedFee);

          log.debug(messages[0]);
          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            fee: usedFee,
            msgs: messages,
          };

          log.debug(JSON.stringify(rawTx));

          const res = await (window as any).dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [rawTx],
            params: [JSON.stringify(rawTx)],
          });

          log.debug('@@@ dapp res', res);

          const code_id = await waitGetCodeID(res[0]);
          await client.terminal.log({ type: 'info', value: `Code ID is ${code_id}` });

          log.debug('code_id', code_id);
          setCodeID(code_id as any);
        } catch (error: any) {
          log.error('signAndSendTransaction error', error);
          await client.terminal.log({ type: 'error', value: error?.message?.toString() });
        }
      });
  };

  return (
    <>
      <Form>
        <Button
          variant="primary"
          onClick={dsrvProceed}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span>Store Code</span>
        </Button>
      </Form>
      <div>
        <Instantiate wallet={wallet} codeID={codeID || ''} setCodeID={setCodeID} />
      </div>
    </>
  );
};

async function simulate(
  client: any,
  messages: readonly any[],
  memo: string | undefined,
  pubKey: string,
  sequence: number,
) {
  const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
  const simulateResult = await client.queryClient.tx.simulate(
    anyMsgs,
    memo,
    {
      type: 'tendermint/PubKeySecp256k1',
      value: pubKey,
    },
    `${sequence}`,
  );
  return simulateResult.gasInfo.gasUsed;
}
