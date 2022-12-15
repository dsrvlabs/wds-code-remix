import React, { Dispatch, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { StargateClient } from '@cosmjs/stargate';
import { Instantiate } from './Instantiate';

import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';

interface InterfaceProps {
  dapp: any;
  wallet: string;
  compileTarget: string;
  client: any;
  wasm: string;
  setWasm: Dispatch<React.SetStateAction<string>>;
}

export const StoreCode: React.FunctionComponent<InterfaceProps> = ({ wasm, wallet }) => {
  const [txHash, setTxHash] = useState<string>('');
  const [codeID, setCodeID] = useState<string>('');

  const waitGetCodeID = async (hash: string) => {
    const rpcUrl = 'https://rpc.uni.junonetwork.io/';
    const client = await StargateClient.connect(rpcUrl);

    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const result = await client.getTx(hash);
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
          const rpcUrl = 'https://rpc.uni.junonetwork.io/';

          const client = await StargateClient.connect(rpcUrl);
          log.debug(client);

          const sequence = (await client.getSequence(result['juno'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await client.getSequence(result['juno'].address)).accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await client.getChainId();
          log.debug('chainId: ' + chainId);

          // const compressed = pako.gzip((wasm), { level: 9 });

          log.debug(wasm);

          const storeCodeMsg = {
            typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
            value: MsgStoreCode.fromPartial({
              sender: result['juno'].address,
              wasmByteCode: wasm as any,
            }),
          };

          log.debug(storeCodeMsg);

          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            fee: {
              amount: [{ denom: 'ujunox', amount: '50000' }],
              gas: 200000,
            },
            msgs: [storeCodeMsg],
          };

          log.debug(rawTx);

          const res = await (window as any).dapp.request('juno', {
            method: 'dapp:sendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.debug(res);

          const code_id = await waitGetCodeID(res[0]);
          log.debug('code_id', code_id);
          setCodeID(code_id as any);
        } catch (error) {
          log.error('>>>에러', error);
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
