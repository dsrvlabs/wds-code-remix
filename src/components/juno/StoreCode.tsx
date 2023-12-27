import React, { Dispatch, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { calculateFee, GasPrice, StargateClient, StdFee } from '@cosmjs/stargate';
import { Instantiate } from './Instantiate';

import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';
import { Decimal } from '@cosmjs/math';
import { simulate } from './juno-helper';

interface InterfaceProps {
  dapp: any;
  wallet: string;
  compileTarget: string;
  client: any;
  wasm: string;
  setWasm: Dispatch<React.SetStateAction<string>>;
  checksum: string;
  txHash: string;
  setTxHash: Dispatch<React.SetStateAction<string>>;
  codeID: string;
  setCodeID: Dispatch<React.SetStateAction<string>>;
  schemaInit: { [key: string]: any };
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  account: string;
  timestamp: string;
}

export const StoreCode: React.FunctionComponent<InterfaceProps> = ({
  dapp,
  wasm,
  checksum,
  wallet,
  client,
  txHash,
  setTxHash,
  codeID,
  setCodeID,
  schemaInit,
  schemaExec,
  schemaQuery,
  account,
  timestamp,
}) => {
  const [gasPrice, setGasPrice] = useState<number>(0.025);
  const [fund, setFund] = useState<number>(0);

  const waitGetCodeID = async (hash: string) => {
    const cid = dapp.networks.juno.chain;

    let rpcUrl = 'https://uni-rpc.reece.sh/';
    if (cid === 'juno') {
      rpcUrl = 'https://rpc-juno.itastakers.com';
    }

    const stargateClient = await StargateClient.connect(rpcUrl);

    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const result = await stargateClient.getTx(hash);
        console.log('!!! waitGetCodeID interval', result);
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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!Number.isNaN(value) && value > 0) {
      setFund(value);
    } else {
      setFund(0);
    }
  };

  const dsrvProceed = async () => {
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
          log.debug('@@@ gasPrice', gasPrice);
          log.debug('@@@ denom', gasEstimation);

          const gas = new GasPrice(Decimal.fromUserInput(String(gasPrice), 18), denom);

          // const multiplier = 1.3;
          // const usedFee = calculateFee(Math.round(gasEstimation * multiplier), gas);
          const usedFee: StdFee = calculateFee(Number(gasEstimation), gas);

          // log.debug('@@@ usedFee', usedFee);

          log.debug(messages[0]);
          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            // fee: usedFee,
            fee: usedFee,
            msgs: messages,
          };

          // log.debug(JSON.stringify(rawTx));

          const res = await dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.info('@@@ dapp res', JSON.stringify(res, null, 2));

          const code_id = await waitGetCodeID(res[0]);
          await client.terminal.log({ type: 'info', value: `Code ID is ${code_id}` });

          log.info('code_id', code_id);
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
        <hr />
        <Form>
          <Form.Text className="text-muted" style={mb4}>
            <small>FUND VALUE</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="number"
              placeholder="0"
              value={fund}
              size="sm"
              onChange={(e) => setFund(Number(e.target.value))}
              onBlur={handleBlur}
            />
            <Form.Control type="text" placeholder="" value={'ujuno / ujunox'} size="sm" readOnly />
          </InputGroup>
        </Form>
        <Form>
          <Form.Text className="text-muted" style={mb4}>
            <small>GAS PRICE</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="number"
              placeholder={gasPrice.toString()}
              value={gasPrice}
              size="sm"
              onChange={(e) => setGasPrice(Number(e.target.value))}
            />
            <Form.Control type="text" placeholder="" value={'ujuno / ujunox'} size="sm" readOnly />
          </InputGroup>
        </Form>
        <hr />
        <Button
          variant="primary"
          onClick={dsrvProceed}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span>Store Code</span>
        </Button>
      </Form>
      <hr />
      <div>
        {codeID && (
          <>
            <Instantiate
              client={client}
              dapp={dapp}
              wallet={wallet}
              codeID={codeID || ''}
              setCodeID={setCodeID}
              fund={fund}
              gasPrice={gasPrice}
              schemaInit={schemaInit}
              schemaExec={schemaExec}
              schemaQuery={schemaQuery}
              account={account}
              timestamp={timestamp}
              checksum={checksum}
            />
          </>
        )}
      </div>
    </>
  );
};

const mb4 = {
  marginBottom: '4px',
};
