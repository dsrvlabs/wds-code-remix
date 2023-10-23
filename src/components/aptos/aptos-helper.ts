import {
  AptosClient,
  BCS,
  HexString,
  TransactionBuilderEd25519,
  TxnBuilderTypes,
  Types,
  TypeTagParser,
} from 'aptos';
import { sha3_256 } from 'js-sha3';
import { log } from '../../utils/logger';
import { ensureBigInt, ensureNumber, serializeArg } from './transaction_builder/builder_utils';

export interface ViewResult {
  result?: Types.MoveValue;
  error: string;
}

export interface ArgTypeValuePair {
  type: string;
  val: any;
}

export async function dappTxn(
  accountId: string,
  chainId: string,
  module: string,
  func: string,
  type_args: BCS.Seq<TxnBuilderTypes.TypeTag>,
  args: BCS.Seq<BCS.Bytes>,
  dapp: any,
  gasUnitPrice: string,
  maxGasAmount: string,
) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const rawTransaction = await aptosClient.generateRawTransaction(
    new HexString(accountId),
    genPayload(module, func, type_args, args),
  );
  log.info(`rawTransaction`, rawTransaction);

  const sendingRawTransaction = await aptosClient.generateRawTransaction(
    new HexString(accountId),
    genPayload(module, func, type_args, args),
    {
      gasUnitPrice: gasUnitPrice ? BigInt(gasUnitPrice) : rawTransaction.gas_unit_price,
      maxGasAmount: maxGasAmount ? BigInt(maxGasAmount) : rawTransaction.max_gas_amount,
    },
  );
  log.info(`sendingRawTransaction`, sendingRawTransaction);

  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return (
    '0x' +
    header.toString('hex') +
    Buffer.from(BCS.bcsToBytes(sendingRawTransaction)).toString('hex')
  );
}

export function genPayload(
  module: string,
  func: string,
  type_args: BCS.Seq<TxnBuilderTypes.TypeTag>,
  args: BCS.Seq<BCS.Bytes>,
) {
  return new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(module, func, type_args, args),
  );
}

export function metadataSerializedBytes(base64EncodedMetadata: string) {
  return BCS.bcsSerializeBytes(
    new HexString(Buffer.from(base64EncodedMetadata, 'base64').toString('hex')).toUint8Array(),
  );
}

export function codeBytes(base64EncodedModules: string[]): BCS.Bytes {
  const modules = base64EncodedModules
    .map((module) => Buffer.from(module, 'base64'))
    .map((buf) => new TxnBuilderTypes.Module(new HexString(buf.toString('hex')).toUint8Array()));

  const codeSerializer = new BCS.Serializer();
  BCS.serializeVector(modules, codeSerializer);
  return codeSerializer.getBytes();
}

export async function waitForTransactionWithResult(txnHash: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return aptosClient.waitForTransactionWithResult(txnHash);
}

export async function getTx(txnHash: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return aptosClient.getTransactionByHash(txnHash);
}

export function serializedArgs(args_: ArgTypeValuePair[]) {
  return args_.map((arg, idx) => {
    if (arg.type === 'bool') {
      return BCS.bcsSerializeBool(arg.val === 'true');
    } else if (arg.type === 'u8') {
      return BCS.bcsSerializeU8(Number(arg.val));
    } else if (arg.type === 'u16') {
      return BCS.bcsSerializeU16(Number(arg.val));
    } else if (arg.type === 'u32') {
      return BCS.bcsSerializeU32(Number(arg.val));
    } else if (arg.type === 'u64') {
      return BCS.bcsSerializeUint64(Number(arg.val));
    } else if (arg.type === 'u128') {
      return BCS.bcsSerializeU128(Number(arg.val));
    } else if (arg.type === 'u256') {
      const serializer = new BCS.Serializer();
      serializer.serializeU256(Number(arg.val));
      return serializer.getBytes();
    } else if (arg.type === 'address') {
      const address = TxnBuilderTypes.AccountAddress.fromHex(arg.val);
      return BCS.bcsToBytes(address);
    } else if (arg.type === '0x1::string::String') {
      const ser = new BCS.Serializer();
      ser.serializeStr(arg.val);
      return ser.getBytes();
    } else if (arg.type.startsWith('vector')) {
      const ser = new BCS.Serializer();
      const parser = new TypeTagParser(arg.type);
      const typeTag = parser.parseTypeTag();
      serializeArg(arg.val, typeTag, ser);
      return ser.getBytes();
    }
    // else if (arg.type === 'vector<0x1::string::String>') {
    //   const strs = arg.val.split(',');
    //   return BCS.serializeVectorWithFunc(strs, 'serializeStr');
    // } else if (arg.type === 'vector<vector<u8>>') {
    //   const hexStrs = arg.val.split(',');
    //   const serializer = new BCS.Serializer();
    //   serializer.serializeU32AsUleb128(hexStrs.length);
    //   hexStrs.forEach((hexStr) => {
    //     const uint8Arr = new HexString(hexStr).toUint8Array();
    //     serializer.serializeBytes(uint8Arr);
    //   });
    //   return serializer.getBytes();
    // } else if (arg.type === 'vector<bool>') {
    //   const strs = arg.val.split(',').map((v) => v === 'true');
    //   return BCS.serializeVectorWithFunc(strs, 'serializeBool');
    // }
    else {
      const ser = new BCS.Serializer();
      ser.serializeBytes(new HexString(arg.val).toUint8Array());
      return ser.getBytes();
    }
  });
}

export function getVectorArgTypeStr(vectorTypeFullName: string): string {
  const argType = extractVectorElementTypeTag(vectorTypeFullName);
  if (argType instanceof TxnBuilderTypes.TypeTagBool) {
    return 'bool';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU8) {
    return 'u8';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU16) {
    return 'u16';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU32) {
    return 'u32';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU64) {
    return 'u64';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU128) {
    return 'u128';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagU256) {
    return 'u256';
  }
  if (argType instanceof TxnBuilderTypes.TypeTagAddress) {
    return 'address';
  }

  if (argType instanceof TxnBuilderTypes.TypeTagStruct) {
    const {
      address,
      module_name: moduleName,
      name,
    } = (argType as TxnBuilderTypes.TypeTagStruct).value;
    if (
      `${HexString.fromUint8Array(address.address).toShortString()}::${moduleName.value}::${
        name.value
      }` !== '0x1::string::String'
    ) {
      throw new Error('The only supported struct arg is of type 0x1::string::String');
    }
    return '0x1::string::String';
  }
  throw new Error('Unsupported arg type.');
}

export function extractVectorElementTypeTag(vectorType: string): TxnBuilderTypes.TypeTag {
  const depth = wordCount(vectorType, 'vector');
  const parser = new TypeTagParser(vectorType);
  let curTypeTag: TxnBuilderTypes.TypeTag = parser.parseTypeTag();
  for (let i = 0; i < depth; i++) {
    if (curTypeTag instanceof TxnBuilderTypes.TypeTagVector) {
      curTypeTag = curTypeTag.value;
    }
  }

  return curTypeTag;
}

export function parseArgVal(argVal: any, argType: TxnBuilderTypes.TypeTag) {
  if (argType instanceof TxnBuilderTypes.TypeTagBool) {
    return argVal;
  }

  if (
    argType instanceof TxnBuilderTypes.TypeTagU8 ||
    argType instanceof TxnBuilderTypes.TypeTagU16 ||
    argType instanceof TxnBuilderTypes.TypeTagU32
  ) {
    return ensureNumber(argVal);
  }

  if (
    argType instanceof TxnBuilderTypes.TypeTagU64 ||
    argType instanceof TxnBuilderTypes.TypeTagU128 ||
    argType instanceof TxnBuilderTypes.TypeTagU256
  ) {
    return ensureBigInt(argVal);
  }

  if (argType instanceof TxnBuilderTypes.TypeTagAddress) {
    return TxnBuilderTypes.AccountAddress.fromHex(argVal);
  }

  if (argType instanceof TxnBuilderTypes.TypeTagStruct) {
    const {
      address,
      module_name: moduleName,
      name,
    } = (argType as TxnBuilderTypes.TypeTagStruct).value;
    if (
      `${HexString.fromUint8Array(address.address).toShortString()}::${moduleName.value}::${
        name.value
      }` !== '0x1::string::String'
    ) {
      throw new Error('The only supported struct arg is of type 0x1::string::String');
    }
    return argVal;
  }

  throw new Error(`Unsupported Type. ${argType}`);
}

export function wordCount(str: string, word: string): number {
  let depth = 0;
  let curIdx = -1;
  while (curIdx < str.length) {
    curIdx = str.indexOf(word, curIdx);
    if (curIdx === -1) {
      break;
    }
    depth++;
    curIdx = curIdx + word.length;
  }
  return depth;
}

export async function getAccountModules(account: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return await aptosClient.getAccountModules(account);
}

export async function getAccountResources(account: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return await aptosClient.getAccountResources(account);
}

export async function viewFunction(
  account: string,
  moduleName: string,
  functionName: string,
  chainId: string,
  typeArg: string[],
  param: ArgTypeValuePair[],
): Promise<ViewResult> {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const payload = {
    function: account + '::' + moduleName + '::' + functionName,
    type_arguments: typeArg,
    arguments: param.map((p) => {
      if (p.type === 'vector<u8>') {
        const vals: number[] = p.val;
        return Buffer.from(vals).toString();
      }

      if (p.type === 'bool') {
        return p.val === 'true' ? true : false;
      }

      return p.val;
    }),
  };
  console.log(`viewFunction payload=${JSON.stringify(payload, null, 2)}`);

  try {
    const res = await aptosClient.view(payload);
    log.info(res);
    return {
      result: res,
      error: '',
    };
  } catch (e: any) {
    return {
      result: undefined,
      error: e.toString(),
    };
  }
}

export const getEstimateGas = async (
  url: string,
  pubKey: string,
  rawTransaction: TxnBuilderTypes.RawTransaction,
): Promise<{ gas_unit_price: string; max_gas_amount: string; gas_used: string }> => {
  // eslint-disable-next-line no-unused-vars
  const txnBuilder = new TransactionBuilderEd25519(
    (_signingMessage: TxnBuilderTypes.SigningMessage) => {
      // @ts-ignore
      const invalidSigBytes = new Uint8Array(64);
      return new TxnBuilderTypes.Ed25519Signature(invalidSigBytes);
    },
    Buffer.from(pubKey.replace('0x', ''), 'hex'),
  );
  const signedTxn = txnBuilder.sign(rawTransaction);

  const response = await fetch(`${url}/transactions/simulate`, {
    method: 'POST',
    headers: {
      // https://github.com/aptos-labs/aptos-core/blob/e7d5f952afe3afcf5d1415b67e167df6d49019bf/ecosystem/typescript/sdk/src/aptos_client.ts#L336
      'Content-Type': 'application/x.aptos.signed_transaction+bcs',
    },
    body: signedTxn,
  });

  const result = await response.json();
  console.log(`simulation result=${JSON.stringify(result, null, 2)}`);
  return {
    gas_unit_price: result[0].gas_unit_price,
    max_gas_amount: result[0].max_gas_amount,
    gas_used: result[0].gas_used,
  };
};

export function aptosNodeUrl(chainId: string) {
  if (chainId === 'mainnet') {
    return 'https://fullnode.mainnet.aptoslabs.com';
  }

  if (chainId === 'testnet') {
    return 'https://fullnode.testnet.aptoslabs.com';
  }

  if (chainId === 'devnet') {
    return 'https://fullnode.devnet.aptoslabs.com';
  }

  throw new Error(`Invalid chainId=${chainId}`);
}

export function shortHex(hex: string) {
  let hex_ = hex.slice(0);
  if (hex_.startsWith('0x')) {
    hex_ = hex_.slice(2);
  }

  const buf = Buffer.from(hex_, 'hex');
  console.log(buf);
  const arr = toArrayBuffer(buf);
  console.log(arr);
  const short = HexString.fromUint8Array(arr).toShortString();
  return short;
}

function toArrayBuffer(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return Uint8Array.from(view);
}
