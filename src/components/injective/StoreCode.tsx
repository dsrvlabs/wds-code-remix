import { Button, Form, InputGroup } from 'react-bootstrap';
import React, { Dispatch, useState } from 'react';
import { log } from '../../utils/logger';
import { TxGrpcApi, MsgStoreCode } from '@injectivelabs/sdk-ts';
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
  compileTarget,
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
  const [fund, setFund] = useState<number>(0);
  const { injectiveBroadcastMsg, injectiveAddress, chainId, walletType } = useWalletStore();

  const waitGetCodeID = async (txHash: string) => {
    const grpcEndpoing = getNetworkEndpoints(
      chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    ).grpc;
    try {
      const txResult = await new TxGrpcApi(grpcEndpoing).fetchTxPoll(txHash, 30000);
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

  const proceedStoreCode = async () => {
    try {
      const buffer = Buffer.from(wasm, 'base64');
      const wasmUint8array = new Uint8Array(buffer);
      const msg = MsgStoreCode.fromJSON({
        sender: injectiveAddress,
        wasmBytes: wasmUint8array,
      });
      const txResult = await injectiveBroadcastMsg(msg, injectiveAddress);
      console.log(txResult);
      log.info(`@@@ MsgStoreCode Transaction Hash: ${txResult!.txHash}`);
      if (txResult?.txHash) {
        await waitGetCodeID(txResult!.txHash);
      } else {
        throw new Error('Error while broadcasting. Please Check your wallet is locked');
      }
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
            <Form.Control
              type="text"
              placeholder=""
              value={compileTarget === 'injective/atomic-order-example' ? 'USDT' : 'inj'}
              size="sm"
              readOnly
            />
          </InputGroup>
        </Form>
        <hr />
        {walletType === 'metamask' ? (
          <Button
            disabled={true}
            className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          >
            Ethereum Native Wallets Can't Deploy Smart Contracts on Injective
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={proceedStoreCode}
            className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          >
            <span>Store Code</span>
          </Button>
        )}
      </Form>
      <hr />
      <div>
        {codeID && (
          <>
            <Instantiate
              compileTarget={compileTarget}
              client={client}
              codeID={codeID || ''}
              setCodeID={setCodeID}
              fund={fund}
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
