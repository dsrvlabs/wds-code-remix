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
import {
  ensureBigInt,
  ensureNumber,
  serializeArg,
} from '../aptos/transaction_builder/builder_utils';
import { NetworkInfo } from '@aptos-labs/wallet-standard';
import { Network } from '@aptos-labs/ts-sdk';

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
  const movementClient = new AptosClient(movementNodeUrl(chainId));

  const rawTransaction = await movementClient.generateRawTransaction(
    new HexString(accountId),
    genPayload(module, func, type_args, args),
  );
  log.info(`rawTransaction`, rawTransaction);

  const sendingRawTransaction = await movementClient.generateRawTransaction(
    new HexString(accountId),
    genPayload(module, func, type_args, args),
    {
      gasUnitPrice: gasUnitPrice ? BigInt(gasUnitPrice) : rawTransaction.gas_unit_price,
      maxGasAmount: maxGasAmount ? BigInt(maxGasAmount) : rawTransaction.max_gas_amount,
    },
  );
  log.info(`sendingRawTransaction`, sendingRawTransaction);

  const message = new TextEncoder().encode('MOVEMENT::RawTransaction');
  const headerHash = sha3_256(message);
  const headerBytes = new Uint8Array(Buffer.from(headerHash, 'hex'));

  return (
    '0x' +
    Buffer.from(headerBytes).toString('hex') +
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
  // Convert base64 encoded modules to Uint8Array array
  const moduleByteArrays = base64EncodedModules.map(
    (module) => new Uint8Array(Buffer.from(module, 'base64')),
  );

  // BCS serialization
  const serializer = new BCS.Serializer();

  // Serialize vector<vector<u8>>
  serializer.serializeU32AsUleb128(moduleByteArrays.length);
  for (const byteArray of moduleByteArrays) {
    serializer.serializeBytes(byteArray);
  }

  return serializer.getBytes();
}

export async function waitForTransactionWithResult(txnHash: string, chainId: string) {
  const movementClient = new AptosClient(movementNodeUrl(chainId));
  return movementClient.waitForTransactionWithResult(txnHash);
}

export async function getTx(txnHash: string | any, chainId: string) {
  const movementClient = new AptosClient(movementNodeUrl(chainId));
  // Attempt to convert hash object to string
  let hashString: string;
  if (typeof txnHash === 'object') {
    try {
      if (txnHash.status) {
        hashString = txnHash.status;
        // Return error immediately for rejected transactions
        if (hashString === 'Rejected') {
          log.error('Transaction rejected by user:', hashString);
          throw new Error('Transaction rejected by user');
        }
      } else if (txnHash.hash) {
        hashString = txnHash.hash;
      } else {
        // Convert object to string
        hashString = JSON.stringify(txnHash);
        log.error('Transaction hash as object:', hashString);
        throw new Error('Invalid transaction hash format: object');
      }
    } catch (e) {
      log.error('Transaction hash processing error:', e);
      throw new Error('Invalid transaction hash format');
    }
  } else {
    hashString = txnHash;
  }
  return movementClient.getTransactionByHash(hashString);
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
  const movementClient = new AptosClient(movementNodeUrl(chainId));
  return await movementClient.getAccountModules(account);
}

export async function getAccountResources(account: string, chainId: string) {
  const movementClient = new AptosClient(movementNodeUrl(chainId));
  return await movementClient.getAccountResources(account);
}

export async function viewFunction(
  account: string,
  moduleName: string,
  functionName: string,
  chainId: string,
  typeArg: string[],
  param: ArgTypeValuePair[],
): Promise<ViewResult> {
  const movementClient = new AptosClient(movementNodeUrl(chainId));

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
  try {
    // The Aptos SDK view function requires a string as the second parameter
    // In the current version, only the ledger_version option is supported, so we don't set it
    const res = await movementClient.view(payload);
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
  // Provide default value if pubKey is missing
  const defaultPubKey = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const pubKeyToUse = pubKey || defaultPubKey;

  // Convert string to Uint8Array directly
  const keyHex = pubKeyToUse.replace('0x', '');
  const keyBytes = new Uint8Array(keyHex.length / 2);

  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes[i / 2] = parseInt(keyHex.substring(i, i + 2), 16);
  }

  // eslint-disable-next-line no-unused-vars
  const txnBuilder = new TransactionBuilderEd25519(
    (_signingMessage: TxnBuilderTypes.SigningMessage) => {
      // @ts-ignore
      const invalidSigBytes = new Uint8Array(64);
      return new TxnBuilderTypes.Ed25519Signature(invalidSigBytes);
    },
    keyBytes,
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
  return {
    gas_unit_price: result[0].gas_unit_price,
    max_gas_amount: result[0].max_gas_amount,
    gas_used: result[0].gas_used,
  };
};

export function movementNodeUrl(chainId: string) {
  if (chainId === 'mainnet') {
    return 'https://mainnet.movementnetwork.xyz/v1';
  }

  if (chainId === 'testnet' || chainId === '250') {
    return 'https://testnet.bardock.movementnetwork.xyz/v1';
  }

  if (chainId === 'devnet') {
    return 'https://devnet.suzuka.movementnetwork.xyz/v1';
  }

  throw new Error(`Invalid chainId=${chainId}`);
}

export function shortHex(hex: string) {
  let hex_ = hex.slice(0);
  if (hex_.startsWith('0x')) {
    hex_ = hex_.slice(2);
  }

  const buf = Buffer.from(hex_, 'hex');
  const arr = toArrayBuffer(buf);
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

export async function waitForTransactionResult(
  hash: string | any,
  chainId: string,
  maxRetries = 15,
  initialDelayMs = 2000,
): Promise<any> {
  // Attempt to convert hash object to string
  let hashString: string;
  if (typeof hash === 'object') {
    try {
      if (hash.status) {
        hashString = hash.status;
        // Return error immediately for rejected transactions
        if (hashString === 'Rejected') {
          log.error('Transaction rejected by user:', hashString);
          throw new Error('Transaction rejected by user');
        }
      } else if (hash.hash) {
        hashString = hash.hash;
      } else {
        // Convert object to string
        hashString = JSON.stringify(hash);
        log.error('Transaction hash as object:', hashString);
        throw new Error('Invalid transaction hash format: object');
      }
    } catch (e) {
      log.error('Transaction hash processing error:', e);
      throw new Error('Invalid transaction hash format');
    }
  } else {
    hashString = hash;
    // String is 'Rejected' - handle
    if (hashString === 'Rejected' || hashString === 'undefined' || hashString === 'Unknown hash') {
      log.error('Invalid transaction hash:', hashString);
      throw new Error('Invalid transaction hash');
    }
  }

  // Minimal hash format validation (must start with 0x and have minimum length)
  if (!hashString.startsWith('0x') || hashString.length < 10) {
    log.error('Invalid transaction hash format:', hashString);
    throw new Error('Invalid transaction hash format');
  }

  log.info(`Waiting for transaction result (hash: ${hashString}), max retries: ${maxRetries}...`);

  let retries = 0;
  let delayMs = initialDelayMs;

  while (retries < maxRetries) {
    try {
      const txResult: any = await getTx(hashString, chainId);
      if (txResult) {
        // Explicitly check for success
        if (txResult.success === false) {
          const vmStatus = txResult.vm_status || '';
          let errorMsg = '';

          // Add specific description for VM errors
          if (vmStatus.includes('Move abort')) {
            // Parse Move abort error format (e.g., "Move abort in 0x1::util: 0x10001")
            const moduleMatch = vmStatus.match(/in ([^:]+):/);
            const codeMatch = vmStatus.match(/: (0x[0-9a-fA-F]+)/);

            const module = moduleMatch ? moduleMatch[1] : 'Unknown module';
            const errorCode = codeMatch ? codeMatch[1] : 'Unknown code';

            errorMsg = `Move contract execution error: Error code ${errorCode} in module ${module}`;

            // Add specific description for specific error codes
            if (errorCode === '0x10001' && module.includes('0x1::util')) {
              errorMsg +=
                '. This typically occurs due to insufficient permissions or invalid input.';
            } else if (errorCode === '0x1000A') {
              errorMsg += '. Error due to insufficient balance.';
            } else if (errorCode === '0x20001') {
              errorMsg += '. Resource already exists or duplication error.';
            } else if (errorCode === '0x30001') {
              errorMsg += '. Required resource not found.';
            }
          } else if (vmStatus.includes('EXECUTION_FAILURE')) {
            errorMsg = `Execution error: ${vmStatus}. An error occurred during transaction execution.`;
          } else if (vmStatus.includes('OUT_OF_GAS')) {
            errorMsg = 'Out of gas: Not enough gas was provided for the transaction.';
          } else {
            errorMsg = `Transaction failed: ${vmStatus || 'Unknown error'}`;
          }

          log.error('Transaction failed:', errorMsg);
          // VM error case - stop retrying immediately
          throw new Error(errorMsg);
        }

        log.info('Transaction query successful:', txResult);
        return txResult;
      }
      throw new Error('Transaction result is empty');
    } catch (error: any) {
      // VM error case - stop retrying immediately
      if (
        error.message &&
        (error.message.includes('Move contract execution error') ||
          error.message.includes('Move abort') ||
          error.message.includes('Execution error') ||
          error.message.includes('Out of gas'))
      ) {
        log.error('Retry stopped due to VM error:', error.message);
        throw error; // VM errors won't change with retries, so propagate immediately
      }

      retries++;

      // Specific error condition - stop immediately
      if (error.message && error.message.includes('Invalid hash')) {
        log.error('Invalid transaction hash format:', error);
        throw error;
      }

      if (retries >= maxRetries) {
        log.error(`Maximum retry count (${maxRetries}) reached.`);
        throw new Error(`Transaction verification failed: ${error.message || 'Unknown error'}`);
      }

      // Apply exponential backoff (up to 30 seconds)
      delayMs = Math.min(delayMs * 1.5, 30000);

      log.info(
        `Transaction is still being processed. Retrying after ${delayMs}ms (${retries}/${maxRetries})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Transaction query timeout');
}

export const getNetworkInfo = (network: string | number): NetworkInfo & { network: string } => {
  switch (network) {
    case 'Movement Mainnet':
    case 1:
      return {
        chainId: 1,
        name: Network.CUSTOM,
        network: 'mainnet',
        url: 'https://mainnet.movementnetwork.xyz/v1',
      };
    case 'Movement Testnet':
    case 250:
    default:
      return {
        chainId: 250,
        name: Network.CUSTOM,
        network: 'testnet',
        url: 'https://testnet.bardock.movementnetwork.xyz/v1',
      };
  }
};
