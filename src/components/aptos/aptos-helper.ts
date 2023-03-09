import { AptosClient, BCS, HexString, TxnBuilderTypes, Types, TypeTagParser } from 'aptos';
import { sha3_256 } from 'js-sha3';
import { log } from '../../utils/logger';

export interface ViewResult {
  result?: Types.MoveValue;
  error: string;
}

export interface ArgTypeValuePair {
  type: string;
  val: string;
}

export async function dappTxn(
  accountId: string,
  chainId: string,
  module: string,
  func: string,
  type_args: BCS.Seq<TxnBuilderTypes.TypeTag>,
  args: BCS.Seq<BCS.Bytes>,
) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  const rawTransaction = await aptosClient.generateRawTransaction(
    new HexString(accountId),
    genPayload(module, func, type_args, args),
  );
  log.info(`rawTransaction`, rawTransaction);

  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return (
    '0x' + header.toString('hex') + Buffer.from(BCS.bcsToBytes(rawTransaction)).toString('hex')
  );
}

function genPayload(
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
    } else if (arg.type === 'vector<0x1::string::String>') {
      const strs = arg.val.split(',');
      return BCS.serializeVectorWithFunc(strs, 'serializeStr');
    } else if (arg.type === 'vector<vector<u8>>') {
      const hexStrs = arg.val.split(',');
      const serializer = new BCS.Serializer();
      serializer.serializeU32AsUleb128(hexStrs.length);
      hexStrs.forEach((hexStr) => {
        const uint8Arr = new HexString(hexStr).toUint8Array();
        serializer.serializeBytes(uint8Arr);
      });
      return serializer.getBytes();
    } else if (arg.type === 'vector<bool>') {
      const strs = arg.val.split(',').map((v) => v === 'true');
      return BCS.serializeVectorWithFunc(strs, 'serializeBool');
    } else {
      const ser = new BCS.Serializer();
      ser.serializeBytes(new HexString(arg.val).toUint8Array());
      return ser.getBytes();
    }
  });
}

export function extractVectorTypeTagName(vectorType: string) {
  const depth = wordCount(vectorType, 'vector');
  for (let i = 0; i++; i < depth) {
    const curVectorType = vectorType;
    const parser = new TypeTagParser(curVectorType);
  }
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
    arguments: param.map((p) => p.val),
  };

  log.debug(payload);

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

// export const estimateGas = async (url: string, account: Account, rawTransaction: TxnBuilderTypes.RawTransaction): Promise<string> => {
//   // eslint-disable-next-line no-unused-vars
//   const txnBuilder = new TransactionBuilderEd25519((_signingMessage: TxnBuilderTypes.SigningMessage) => {
//     // @ts-ignore
//     const invalidSigBytes = new Uint8Array(64);
//     return new TxnBuilderTypes.Ed25519Signature(invalidSigBytes);
//   }, Buffer.from(account.pubKey.replace('0x', ''), 'hex'));
//   const signedTxn = txnBuilder.sign(rawTransaction);

//   const response = await fetch(`${url}/transactions/simulate`, {
//     method: 'POST',
//     headers: {
//       // https://github.com/aptos-labs/aptos-core/blob/e7d5f952afe3afcf5d1415b67e167df6d49019bf/ecosystem/typescript/sdk/src/aptos_client.ts#L336
//       'Content-Type': 'application/x.aptos.signed_transaction+bcs',
//     },
//     body: signedTxn,
//   });

//   const result = await response.json();
//   return result[0].max_gas_amount;
// };

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
