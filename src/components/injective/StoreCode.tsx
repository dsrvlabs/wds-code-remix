import { Button, Form, InputGroup } from 'react-bootstrap';
import React, { Dispatch, useState } from 'react';
import { log } from '../../utils/logger';
import {
  TxGrpcClient,
  MsgStoreCode,
  getEip712TypedDataV2,
  ChainGrpcAuthApi,
  ChainGrpcTendermintApi,
  SIGN_EIP712_V2,
  createTransaction,
  createTxRawEIP712,
  createWeb3Extension,
  getGasPriceBasedOnMessage,
  hexToBuff,
} from '@injectivelabs/sdk-ts';
import { ChainId, EthereumChainId } from '@injectivelabs/ts-types';
import { BigNumberInBase, DEFAULT_BLOCK_TIMEOUT_HEIGHT, getStdFee } from '@injectivelabs/utils';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { Instantiate } from './Instantiate';
import { useWalletStore } from './WalletContextProvider';
import { Wallet } from '@injectivelabs/wallet-ts';
import { UtilsWallets } from '@injectivelabs/wallet-ts/dist/esm/exports';

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
  const [fund, setFund] = useState<number>(0);
  const { injectiveBroadcastMsg, injectiveAddress, walletStrategy, chainId } = useWalletStore();

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

  // const metaMaskProceed = async () => {
  //   await UtilsWallets.updateMetamaskNetwork(EthereumChainId.Sepolia);

  //   const endpoint = getNetworkEndpoints(Network.Testnet);

  //   const accountDetails = await new ChainGrpcAuthApi(endpoint.grpc).fetchAccount(injectiveAddress);
  //   const { baseAccount } = accountDetails;

  //   const latestBlock = await new ChainGrpcTendermintApi(endpoint.grpc).fetchLatestBlock();
  //   const latestHeight = latestBlock!.header!.height;
  //   const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);

  //   const buffer = Buffer.from(wasm, 'base64');

  //   const wasmUint8array = new Uint8Array(buffer);

  //   const msg = MsgStoreCode.fromJSON({
  //     sender: injectiveAddress,
  //     wasmBytes: wasmUint8array,
  //   });

  //   let gasFee = getGasPriceBasedOnMessage([msg]).toString(); // TODO: Add custom gas
  //   if (baseAccount.pubKey) {
  //     gasFee = (
  //       await simulateInjectiveTx(
  //         endpoint.grpc,
  //         baseAccount.pubKey,
  //         chainId,
  //         msg,
  //         baseAccount.sequence,
  //         baseAccount.accountNumber,
  //       )
  //     ).toString();
  //   }

  //   // This is where string is changed to uint8Array
  //   const eip712TypedData = getEip712TypedDataV3({
  //     wasm: wasm,
  //     msgs: [msg],
  //     fee: { gas: gasFee },
  //     tx: {
  //       memo: undefined,
  //       accountNumber: baseAccount.accountNumber.toString(),
  //       sequence: baseAccount.sequence.toString(),
  //       timeoutHeight: timeoutHeight.toFixed(),
  //       chainId: chainId,
  //     },
  //     ethereumChainId: EthereumChainId.Sepolia,
  //   });
  //   console.log(eip712TypedData);
  //   // eip712TypedData.message.msgs hardcode the string value here and it is fixed
  //   const signature = await walletStrategy!.signEip712TypedData(
  //     JSON.stringify(eip712TypedData),
  //     ethAddress,
  //   );

  //   /** Get Public Key of the signer */
  //   const pubKeyOrSignatureDerivedPubKey = getEthereumWalletPubKey({
  //     pubKey: baseAccount.pubKey?.key,
  //     eip712TypedData,
  //     signature,
  //   });

  //   const { txRaw } = createTransaction({
  //     message: [msg],
  //     memo: undefined,
  //     signMode: SIGN_EIP712_V2,
  //     fee: getStdFee({ gas: gasFee }),
  //     pubKey: pubKeyOrSignatureDerivedPubKey,
  //     sequence: baseAccount.sequence,
  //     timeoutHeight: timeoutHeight.toNumber(),
  //     accountNumber: baseAccount.accountNumber,
  //     chainId,
  //   });
  //   const web3Extension = createWeb3Extension({
  //     ethereumChainId: EthereumChainId.Sepolia,
  //   });
  //   const txRawEip712 = createTxRawEIP712(txRaw, web3Extension);
  //   txRawEip712.signatures = [hexToBuff(signature)];
  //   const res = await walletStrategy?.sendTransaction(txRawEip712, {
  //     chainId: ChainId.Testnet,
  //     endpoints: endpoint,
  //     txTimeout: 30,
  //     address: injectiveAddress,
  //   });
  // };

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
          onClick={proceedStoreCode}
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
