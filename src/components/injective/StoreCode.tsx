import React, { Dispatch, useEffect, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { log } from '../../utils/logger';
import {
  ChainRestAuthApi,
  BaseAccount,
  createTransaction,
  ChainRestTendermintApi,
  CosmosTxV1Beta1Tx,
  BroadcastModeKeplr,
  getTxRawFromTxRawOrDirectSignResponse,
  TxRaw,
  MsgSend,
  TxRestClient,
  TxGrpcClient,
} from '@injectivelabs/sdk-ts';
import { MsgStoreCode } from '@injectivelabs/sdk-ts';
import { ChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { getStdFee, BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT } from '@injectivelabs/utils';
import { TransactionException } from '@injectivelabs/exceptions';
import { SignDoc } from '@keplr-wallet/types';

import { MsgBroadcaster, WalletStrategy } from '@injectivelabs/wallet-ts';
import { simulateInjectiveTx } from './injective-helper';
import { Instantiate } from './Instantiate';

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
  const [gasPrice, setGasPrice] = useState<number>(0.00016);
  const [fund, setFund] = useState<number>(0);

  const waitGetCodeID = async (txHash: string) => {
    const grpcEndpoing = getNetworkEndpoints(Network.Testnet).grpc;
    await new TxGrpcClient(grpcEndpoing).fetchTxPoll(txHash, 30000).then((res: any) => {
      const codeId = res.logs[0]?.events
        .find((value: { type: string }) => value.type === 'cosmwasm.wasm.v1.EventCodeStored')
        .attributes.find((value: { key: string }) => value.key === 'code_id')
        .value.replace(/['"]+/g, '');
      setCodeID(codeId);
    });
  };

  const keplrProceed = async () => {
    if (!providerInstance) return;
    try {
      const injAddr = account;

      const chainId = providerNetwork;

      const restEndpoint = getNetworkEndpoints(Network.Testnet).rest;
      const grpcEndpoint = getNetworkEndpoints(Network.Testnet).grpc;
      const chainRestAuthApi = new ChainRestAuthApi(restEndpoint);

      const accountDetailsResponse = await chainRestAuthApi.fetchAccount(injAddr);

      const baseAccount = BaseAccount.fromRestApi(accountDetailsResponse);

      const pubkey = Buffer.from((await providerInstance.getKey(chainId)).pubKey).toString(
        'base64',
      );
      const keplrInstance = (window as any).keplr;
      const offlineSigner = keplrInstance.getOfflineSigner(chainId);

      const chainRestTendermintApi = new ChainRestTendermintApi(restEndpoint);
      const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
      const latestHeight = latestBlock.header.height;
      const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);
      const buffer = Buffer.from(wasm, 'base64');
      const wasmUint8array = new Uint8Array(buffer);
      const msg = MsgStoreCode.fromJSON({
        sender: injAddr,
        wasmBytes: wasmUint8array,
      });

      const gasFee = await simulateInjectiveTx(
        grpcEndpoint,
        pubkey,
        chainId,
        msg,
        baseAccount.sequence,
        baseAccount.accountNumber,
      );
      const { signDoc } = createTransaction({
        pubKey: pubkey,
        chainId: chainId,
        fee: getStdFee({ gas: gasFee }),
        message: msg,
        sequence: baseAccount.sequence,
        timeoutHeight: timeoutHeight.toNumber(),
        accountNumber: baseAccount.accountNumber,
      });
      const directSignResponse = await offlineSigner.signDirect(
        injAddr,
        signDoc as unknown as SignDoc,
      );
      const txRaw = getTxRawFromTxRawOrDirectSignResponse(directSignResponse);

      const broadcastTx = async (chainId: String, txRaw: TxRaw) => {
        const result = await keplrInstance.sendTx(
          chainId,
          CosmosTxV1Beta1Tx.TxRaw.encode(txRaw).finish(),
          BroadcastModeKeplr.Sync,
        );

        if (!result || result.length === 0) {
          throw new TransactionException(new Error('Transaction failed to be broadcasted'), {
            contextModule: 'Keplr',
          });
        }

        return Buffer.from(result).toString('hex');
      };
      const txHash = await broadcastTx(ChainId.Testnet, txRaw);
      log.info(`@@@ MsgStoreCode Transaction Hash: ${txHash}`);
      await waitGetCodeID(txHash);
    } catch (error: any) {
      log.error('signAndSendTransaction error', error);
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
