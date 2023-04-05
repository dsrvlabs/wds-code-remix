import { AptosClient, BCS, HexString, TxnBuilderTypes, Types, TypeTagParser } from 'aptos';
import { sha3_256 } from 'js-sha3';
import { log } from '../../utils/logger';
import { ensureBigInt, ensureNumber, serializeArg } from './transaction_builder/builder_utils';
import { CompiledModulesAndDeps } from 'wds-event';
import {
  Connection,
  fromB64,
  JsonRpcProvider,
  normalizeSuiObjectId,
  TransactionBlock,
} from '@mysten/sui.js';
import { SuiModule } from './sui-types';
import { SuiObjectData } from '@mysten/sui.js/src/types/objects';
import { SuiMoveNormalizedType } from '@mysten/sui.js/dist/types/normalized';

const yaml = require('js-yaml');
export type SuiChainId = 'mainnet' | 'testnet' | 'devnet';

export interface ViewResult {
  result?: Types.MoveValue;
  error: string;
}

export interface ArgTypeValuePair {
  type: string;
  val: any;
}

export async function dappPublishTxn(
  accountId: string,
  chainId: SuiChainId,
  compiledModulesAndDeps: CompiledModulesAndDeps,
) {
  const tx = new TransactionBlock();
  // TODO: Publish dry runs fail currently, so we need to set a gas budget:
  tx.setGasBudget(10000);
  const cap = tx.publish(
    compiledModulesAndDeps.modules.map((m: any) => Array.from(fromB64(m))),
    compiledModulesAndDeps.dependencies.map((addr: string) => normalizeSuiObjectId(addr)),
  );
  tx.transferObjects([cap], tx.pure(accountId));
  tx.setSender(accountId);
  const bcsTx = await tx.build({ provider: getProvider(chainId) });
  log.info(`bcsTx`, bcsTx);

  const header = Buffer.from(sha3_256(Buffer.from('SUI::RawTransaction', 'ascii')), 'hex');
  return '0x' + header.toString('hex') + Buffer.from(bcsTx).toString('hex');
}

export async function moveCallTxn(
  accountId: string,
  chainId: SuiChainId,
  packageId: string,
  moduleName: string,
  funcName: string,
  args: string[],
) {
  const tx = new TransactionBlock();
  // TODO: Publish dry runs fail currently, so we need to set a gas budget:
  tx.setGasBudget(10000);
  tx.moveCall({
    target: `${packageId}::${moduleName}::${funcName}`,
    arguments: args.map((arg) => tx.pure(arg)),
  });
  tx.setSender(accountId);
  log.info('tx', tx);

  const bcsTx = await tx.build({ provider: getProvider(chainId) });
  log.info(`bcsTx`, bcsTx);

  const header = Buffer.from(sha3_256(Buffer.from('SUI::RawTransaction', 'ascii')), 'hex');
  return '0x' + header.toString('hex') + Buffer.from(bcsTx).toString('hex');
}

export function getProvider(chainId: SuiChainId): JsonRpcProvider {
  if (chainId === 'mainnet') {
    return new JsonRpcProvider(
      new Connection({
        fullnode: 'https://fullnode.mainnet.sui.io:443/',
        faucet: 'https://faucet.mainnet.sui.io/gas',
      }),
      {
        skipDataValidation: false,
      },
    );
  }

  if (chainId === 'testnet') {
    return new JsonRpcProvider(
      new Connection({
        fullnode: 'https://fullnode.testnet.sui.io:443/',
        faucet: 'https://faucet.testnet.sui.io/gas',
      }),
      {
        skipDataValidation: false,
      },
    );
  }

  if (chainId === 'devnet') {
    return new JsonRpcProvider(
      new Connection({
        fullnode: 'https://fullnode.devnet.sui.io:443/',
        faucet: 'https://faucet.devnet.sui.io/gas',
      }),
      {
        skipDataValidation: false,
      },
    );
  }

  throw new Error(`Invalid ChainId=${chainId}`);
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

export async function getModules(chainId: SuiChainId, packageId: string): Promise<SuiModule[]> {
  const suiMoveNormalizedModules = await getProvider(chainId).getNormalizedMoveModulesByPackage({
    package: packageId,
  });

  return Object.keys(suiMoveNormalizedModules).map((moduleName) => {
    const module = suiMoveNormalizedModules[moduleName];
    const suiFuncs = Object.keys(module.exposedFunctions).map((funcName) => {
      const func = module.exposedFunctions[funcName];
      return {
        name: funcName,
        ...func,
      };
    });

    const suiStructs = Object.keys(module.structs).map((structName) => {
      const struct = module.structs[structName];
      return {
        name: structName,
        ...struct,
      };
    });
    return {
      fileFormatVersion: module.fileFormatVersion,
      address: module.address,
      name: module.name,
      friends: module.friends,
      exposedFunctions: suiFuncs,
      structs: suiStructs,
    };
  });
}

export async function getPackageIds(account: string, chainId: string): Promise<string[]> {
  const provider = getProvider(chainId as SuiChainId);
  const { data } = await provider.getOwnedObjects({
    owner: account,
    filter: {
      StructType: '0x2::package::UpgradeCap',
    },
    options: {
      showType: true,
      showContent: true,
      showOwner: true,
      showDisplay: true,
    },
  });

  if (!data) {
    return [];
  }

  return data.map((d: any) => d.data?.content?.fields?.package).filter((p) => p !== undefined);
}

export async function getOwnedObjects(
  account: string,
  chainId: SuiChainId,
): Promise<SuiObjectData[]> {
  const provider = await getProvider(chainId);
  const { data } = await provider.getOwnedObjects({
    owner: account,
    options: {
      showType: true,
      showContent: true,
      showOwner: true,
      showDisplay: true,
    },
  });

  return data.map((d) => d.data) as SuiObjectData[];
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

export function parseYaml(str: string) {
  return yaml.load(str);
}

export function initParameters(parameters: SuiMoveNormalizedType[]) {
  return new Array(txCtxRemovedParametersLen(parameters));
}

export function txCtxRemovedParametersLen(parameters: SuiMoveNormalizedType[]) {
  return parameters.filter(
    (p: any, index: number) => !(index === parameters.length - 1 && isTxCtx(p)),
  ).length;
}

export function txCtxRemovedParameters(parameters: SuiMoveNormalizedType[]) {
  return parameters.filter(
    (p: any, index: number) => !(index === parameters.length - 1 && isTxCtx(p)),
  );
}

function isTxCtx(p: any) {
  return (
    p.MutableReference?.Struct?.address === '0x2' &&
    p.MutableReference?.Struct?.module === 'tx_context' &&
    p.MutableReference?.Struct?.name === 'TxContext'
  );
}
