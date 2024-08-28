import {
  Eip712ConvertFeeArgs,
  Eip712ConvertTxArgs,
  Msgs,
  PubKey,
  TxGrpcApi,
  createTransaction,
  getDefaultEip712TypesV2,
  getEip712DomainV2,
  getEipTxContext,
  hexToBase64,
  recoverTypedSignaturePubKey,
  MsgStoreCode,
} from '@injectivelabs/sdk-ts';
import { EthereumChainId } from '@injectivelabs/ts-types';
import { CosmwasmWasmV1Tx } from '@injectivelabs/core-proto-ts';
import snakecaseKeys from 'snakecase-keys';

// export const getEip712TypedDataV3 = ({
//   wasm,
//   msgs,
//   tx,
//   fee,
//   ethereumChainId,
// }: {
//   wasm: string;
//   msgs: Msgs | Msgs[];
//   tx: Eip712ConvertTxArgs;
//   fee?: Eip712ConvertFeeArgs;
//   ethereumChainId: EthereumChainId;
// }) => {
//   const messages = Array.isArray(msgs) ? msgs : [msgs];
//   const eip712Msgs = messages.map((m) => {
//     const message = CosmwasmWasmV1Tx.MsgStoreCode.create();
//     //@ts-ignore
//     const { sender, wasmBytes } = m.params;
//     message.sender = sender;
//     message.wasmByteCode =
//       typeof wasmBytes === 'string' ? fromUtf8(wasmBytes) : (wasm as unknown as Uint8Array);
//     message.instantiatePermission = undefined;
//     return CosmwasmWasmV1Tx.MsgStoreCode.fromPartial(message);
//   });

//   const sMsg = {
//     //@ts-ignore
//     ...snakecaseKeys(eip712Msgs[0]),
//   };
//   const toAmino = {
//     type: 'wasm/MsgStoreCode',
//     value: {
//       ...sMsg,
//     },
//   };
//   const { value } = toAmino;
//   const toWeb3 = {
//     '@type': '/cosmwasm.wasm.v1.MsgStoreCode',
//     ...value,
//   };
//   const types = getDefaultEip712TypesV2();

//   return {
//     ...types,
//     primaryType: 'Tx',
//     ...getEip712DomainV2(ethereumChainId),
//     message: {
//       context: JSON.stringify(getEipTxContext({ ...tx, fee })),
//       msgs: [JSON.stringify(toWeb3)],
//     },
//   };
// };

// export function fromUtf8(str: Uint8Array | string) {
//   if (typeof str !== 'string') {
//     return str;
//   }
//   return new TextEncoder().encode(str);
// }
