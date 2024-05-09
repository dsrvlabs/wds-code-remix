import React, { Dispatch, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import {
  calculateFee,
  GasPrice,
  StargateClient,
  StdFee,
  SigningStargateClient,
} from '@cosmjs/stargate';
import { Instantiate } from './Instantiate';

import { MsgStoreCode } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';
import { Decimal } from '@cosmjs/math';
import { simulate, convertToRealChainId } from './neutron-helper';
import { Registry } from '@cosmjs/proto-signing';

interface InterfaceProps {
  providerInstance: any;
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
  providerNetwork: string;
}

export const StoreCode: React.FunctionComponent<InterfaceProps> = ({
  providerInstance,
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
  providerNetwork,
}) => {
  const [gasPrice, setGasPrice] = useState<number>(0.035);
  const [fund, setFund] = useState<number>(0);

  const waitGetCodeID = async (hash: string) => {
    let realChainId = providerNetwork;

    if (wallet == 'Welldone') {
      realChainId = convertToRealChainId(providerInstance.networks.neutron.chain);
    }

    let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';

    if (realChainId === 'neutron-1') {
      rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
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

  const welldoneProceed = async () => {
    if (!providerInstance) {
      return;
    }

    // wasm이 없을 경우 현재 프로젝트 경로의 wasm 파일 읽어오도록
    if (!wasm) {
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

          const messages = [
            {
              typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
              value: MsgStoreCode.fromPartial({
                sender: result['neutron'].address,
                wasmByteCode: wasm as any,
              }),
            },
          ];

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            messages,
            memo,
            result['neutron'].pubKey,
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

          const res = await providerInstance.request('neutron', {
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

  const keplrProceed = async () => {
    if (!providerInstance) {
      return;
    }

    // wasm이 없을 경우 현재 프로젝트 경로의 wasm 파일 읽어오도록
    if (!wasm) {
    }

    try {
      log.debug('address', account);

      let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';

      if (providerNetwork === 'neutron-1') {
        rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
      }

      let chainid = providerNetwork;
      log.debug('chainid', chainid);

      let pubkey = await providerInstance.getEnigmaPubKey(chainid);
      log.debug('pubkey', bufferToHex(pubkey.buffer));

      let denom = 'untrn';
      log.debug('denom', denom);

      log.debug('rpcUrl', rpcUrl);

      const stargateClient = await StargateClient.connect(rpcUrl);

      const sequence = (await stargateClient.getSequence(account)).sequence;
      log.debug('sequence: ' + sequence);

      const accountNumber = (await stargateClient.getSequence(account)).accountNumber;
      log.debug('accountNumber: ' + accountNumber);

      // MsgStoreCode
      const registry = new Registry();
      registry.register('/cosmwasm.wasm.v1.MsgStoreCode', MsgStoreCode);

      const messages = [
        {
          typeUrl: '/cosmwasm.wasm.v1.MsgStoreCode',
          value: MsgStoreCode.fromPartial({
            sender: account,
            wasmByteCode: wasm as any,
          }),
        },
      ];

      const memo = undefined;
      const gasEstimation = await simulate(
        stargateClient,
        messages,
        memo,
        bufferToHex(pubkey.buffer),
        sequence,
      );
      log.debug('@@@ gasEstimation', gasEstimation);
      log.debug('@@@ gasPrice', gasPrice);
      log.debug('@@@ denom', gasEstimation);

      const gas = new GasPrice(Decimal.fromUserInput(String(gasPrice), 18), denom);

      const multiplier = 1.3;
      const usedFee = calculateFee(Math.round(Number(gasEstimation) * multiplier), gas);
      // const usedFee: StdFee = calculateFee(Number(gasEstimation), gas);

      // log.debug('@@@ usedFee', usedFee);

      log.debug(messages[0]);
      const rawTx = {
        account_number: accountNumber,
        chain_id: chainid,
        sequence: sequence,
        // fee: usedFee,
        fee: usedFee,
        msgs: messages,
      };

      // log.debug(JSON.stringify(rawTx)); // TypeError: Do not know how to serialize a BigInt

      const offlineSigner = providerInstance.getOfflineSigner(chainid);

      const starClient = await SigningStargateClient.connectWithSigner(rpcUrl, offlineSigner, {
        registry,
      });

      const res = await starClient.signAndBroadcast(account, messages, usedFee);
      log.debug(res);

      // log.info('@@@ dapp res', JSON.stringify(res, null, 2)); // TypeError: Do not know how to serialize a BigInt

      const code_id = await waitGetCodeID(res.transactionHash);
      await client.terminal.log({ type: 'info', value: `Code ID is ${code_id}` });

      log.info('code_id', code_id);
      setCodeID(code_id as any);
    } catch (error: any) {
      log.error('signAndSendTransaction error', error);
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
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
            <Form.Control type="text" placeholder="" value={'untrn'} size="sm" readOnly />
          </InputGroup>
        </Form>
        {/*<Form>*/}
        {/*  <Form.Text className="text-muted" style={mb4}>*/}
        {/*    <small>GAS PRICE</small>*/}
        {/*  </Form.Text>*/}
        {/*  <InputGroup>*/}
        {/*    <Form.Control*/}
        {/*      type="number"*/}
        {/*      placeholder={gasPrice.toString()}*/}
        {/*      value={gasPrice}*/}
        {/*      size="sm"*/}
        {/*      onChange={(e) => setGasPrice(Number(e.target.value))}*/}
        {/*    />*/}
        {/*    <Form.Control type="text" placeholder="" value={'untrn'} size="sm" readOnly />*/}
        {/*  </InputGroup>*/}
        {/*</Form>*/}
        <hr />
        <Button
          variant="primary"
          onClick={wallet == 'Welldone' ? welldoneProceed : keplrProceed}
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
              providerInstance={providerInstance}
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
              providerNetwork={providerNetwork}
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
