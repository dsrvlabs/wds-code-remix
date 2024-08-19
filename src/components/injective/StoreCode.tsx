import React, { Dispatch, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { log } from '../../utils/logger';
import {
  TxGrpcClient,
} from '@injectivelabs/sdk-ts';
import { MsgStoreCode } from '@injectivelabs/sdk-ts';
import { ChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Instantiate } from './Instantiate';
import { useWalletStore } from './WalletContextProvider';

interface InterfaceProps {
  compileTarget: string;
  client: any;
  wasm: string;
  setWasm: Dispatch<React.SetStateAction<string>>;
  checksum: string;
  codeID: string;
  setCodeID: Dispatch<React.SetStateAction<string>>;
  schemaInit: { [key: string]: any };
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  timestamp: string;
}

export const StoreCode: React.FunctionComponent<InterfaceProps> = ({
  wasm,
  checksum,
  client,
  codeID,
  setCodeID,
  schemaInit,
  schemaExec,
  schemaQuery,
  timestamp,
}) => {
  const [gasPrice, setGasPrice] = useState<number>(0.00016);
  const [fund, setFund] = useState<number>(0);
  const { injectiveBroadcastMsg, walletAccount, walletStrategy, chainId } = useWalletStore();

  const waitGetCodeID = async (txHash: string) => {
    const grpcEndpoing = getNetworkEndpoints(
      chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    ).grpc;
    try {
      const txResult = await new TxGrpcClient(grpcEndpoing).fetchTxPoll(txHash, 30000);
      const decoder = new TextDecoder();
      const codeIDUint8Array = txResult
        .events!.find(
          (value: { type: string }) => value.type === 'cosmwasm.wasm.v1.EventCodeStored',
        )
        .attributes.find(
          (value: { key: Uint8Array }) => decoder.decode(value.key) === 'code_id',
        ).value;
      const codeId = decoder.decode(codeIDUint8Array).replace(/['"]+/g, '');
      setCodeID(codeId);
    } catch (e: any) {
      console.log(e.message);
    }
  };
  const keplrProceed = async () => {
    try {
      const buffer = Buffer.from(wasm, 'base64');
      const wasmUint8array = new Uint8Array(buffer);
      const msg = MsgStoreCode.fromJSON({
        sender: walletAccount,
        wasmBytes: wasmUint8array,
      });
      const txResult = await injectiveBroadcastMsg(msg, walletAccount);
      log.info(`@@@ MsgStoreCode Transaction Hash: ${txResult!.txHash}`);
      await waitGetCodeID(txResult!.txHash);
    } catch (error: any) {
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
  };
 
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!Number.isNaN(value) && value > 0) {
      setFund(value);
    } else {
      setFund(0);
    }
  };
  return (
    <>
      <Form>
        <hr />
        <Form>
          <Form.Text className="text-muted" style={{ marginBottom: '4px' }}>
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
            <Form.Control type="text" placeholder="" value={'inj'} size="sm" readOnly />
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
          onClick={keplrProceed}
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
              codeID={codeID || ''}
              setCodeID={setCodeID}
              fund={fund}
              gasPrice={gasPrice}
              schemaInit={schemaInit}
              schemaExec={schemaExec}
              schemaQuery={schemaQuery}
              timestamp={timestamp}
              checksum={checksum}
            />
          </>
        )}
      </div>
    </>
  );
};
