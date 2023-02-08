import React, { Dispatch, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { Contract } from './Contract';
import { StargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { EncodeObject } from '@cosmjs/proto-signing';
import { MsgInstantiateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { log } from '../../utils/logger';

export interface MsgInstantiateContractEncodeObject extends EncodeObject {
  readonly typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract';
  readonly value: Partial<MsgInstantiateContract>;
}

interface InterfaceProps {
  wallet: string;
  codeID: string;
  setCodeID: Dispatch<React.SetStateAction<string>>;
}

export const Instantiate: React.FunctionComponent<InterfaceProps> = ({ codeID, setCodeID }) => {
  const [initMsg, setInitMsg] = useState('');
  const [initMsgErr, setInitMsgErr] = useState('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');

  const instantiate = async () => {
    const dapp = (window as any).dapp;

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
          const rpcUrl = 'https://uni-rpc.reece.sh/';

          const client = await StargateClient.connect(rpcUrl);
          log.debug(client);

          const sequence = (await client.getSequence(result['juno'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await client.getSequence(result['juno'].address)).accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await client.getChainId();
          log.debug('chainId: ' + chainId);

          let initMsgObj = {};
          try {
            initMsgObj = JSON.parse(initMsg);
            const objStr = JSON.stringify(initMsgObj, null, 2);
            setInitMsg(objStr);
            setInitMsgErr('');
          } catch (e: any) {
            const error: SyntaxError = e;
            log.error(e);
            setInitMsgErr(error?.message);
            return;
          }

          const instantiateContractMsg: MsgInstantiateContractEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
            value: {
              sender: result['juno'].address,
              admin: result['juno'].address,
              codeId: parseInt(codeID) as any,
              label: 'contract init',
              msg: toBase64(toUtf8(JSON.stringify(initMsgObj))) as any,
              funds: [...[]],
            },
          };

          log.debug(JSON.stringify(instantiateContractMsg));

          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            fee: { amount: [{ denom: 'ujunox', amount: '50000' }], gas: 200000 },
            msgs: [instantiateContractMsg],
          };

          log.debug(rawTx);

          const res = await (window as any).dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [rawTx],
          });

          log.debug(res);

          const contract = await waitGetContract(res[0]);
          log.debug('contract address', contract);
          setContractAddress(contract as any);
        } catch (error) {
          log.error('>>>에러', error);
        }
      });
  };

  const waitGetContract = async (hash: string) => {
    const rpcUrl = 'https://uni-rpc.reece.sh/';
    const client = await StargateClient.connect(rpcUrl);

    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const result = await client.getTx(hash);
        log.debug(result);
        if (!result) {
          setInitMsgErr(`Not found transaction ${hash}`);
          clearInterval(id);
          resolve('');
          return;
        }

        if (result.code !== 0) {
          log.debug(`rawLog=${result?.rawLog}`);
          setInitMsgErr(result?.rawLog || '');
          clearInterval(id);
          resolve('');
          return;
        }

        const contractAddress = JSON.parse(result.rawLog)[0].events[0].attributes[0].value;
        resolve(contractAddress);
        clearInterval(id);
      }, 2000);
    });
  };

  const changeCodeID = (e: { target: { value: any } }) => {
    setCodeID(e.target.value);
  };

  const format = () => {
    try {
      const obj = JSON.parse(initMsg);
      const objStr = JSON.stringify(obj, null, 2);
      setInitMsg(objStr);
      setInitMsgErr('');
    } catch (e: any) {
      const error: SyntaxError = e;
      log.error(e);
      setInitMsgErr(error?.message);
    }
  };

  return (
    <div>
      <Form.Group>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'start',
            margin: '0.3em 0.3em',
          }}
        >
          <div style={{ marginRight: '1em', fontSize: '11px' }}>Code ID</div>
          <Form.Control
            type="number"
            placeholder="code_id"
            size="sm"
            value={codeID}
            onChange={changeCodeID}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', margin: '0.3em 0.3em' }}>
          <div style={{ marginRight: '1em', fontSize: '11px' }}>Instantiate Msg</div>
          <Button onClick={format} size="sm">
            Format
          </Button>
        </div>
        <div style={{ padding: '0.2em' }}>
          <Form.Control
            as="textarea"
            rows={(initMsg.slice().match(/\n/g) || []).length + 1}
            value={initMsg}
            onChange={(e) => setInitMsg(e.target.value)}
          />
          <span style={{ color: 'red' }}>{initMsgErr}</span>
        </div>
        {/*<div*/}
        {/*  style={{*/}
        {/*    display: 'flex',*/}
        {/*    flexDirection: 'column',*/}
        {/*    alignItems: 'start',*/}
        {/*    margin: '0.3em 0.3em',*/}
        {/*  }}*/}
        {/*>*/}
        {/*  <div style={{ marginRight: '1em', fontSize: '11px' }}>Amount</div>*/}
        {/*  <InputGroup>*/}
        {/*    <Form.Control type="text" placeholder="0" size="sm" />*/}
        {/*  </InputGroup>*/}
        {/*</div>*/}
      </Form.Group>
      <Form.Group>
        <Button
          variant="warning"
          onClick={instantiate}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          disabled={!!!codeID}
        >
          <span>Instantiate</span>
        </Button>
        <Form.Label>{contractAddress}</Form.Label>
      </Form.Group>
      {contractAddress ? <Contract contractAddress={contractAddress || ''} /> : <></>}
    </div>
  );
};
