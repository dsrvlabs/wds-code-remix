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
  // base64 인코딩된 모듈을 Uint8Array 배열로 변환
  const moduleByteArrays = base64EncodedModules.map(
    (module) => new Uint8Array(Buffer.from(module, 'base64')),
  );

  // BCS 직렬화
  const serializer = new BCS.Serializer();

  // vector<vector<u8>> 직렬화
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
  // 트랜잭션 해시가 객체인 경우 문자열로 변환 시도
  let hashString: string;
  if (typeof txnHash === 'object') {
    try {
      if (txnHash.status) {
        hashString = txnHash.status;
      } else if (txnHash.hash) {
        hashString = txnHash.hash;
      } else {
        // 객체를 문자열로 변환
        hashString = JSON.stringify(txnHash);
        log.error('객체 타입의 트랜잭션 해시:', hashString);
        throw new Error('유효하지 않은 트랜잭션 해시 형식: 객체');
      }
    } catch (e) {
      log.error('트랜잭션 해시 처리 오류:', e);
      throw new Error('유효하지 않은 트랜잭션 해시 형식');
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
  // pubKey가 없을 경우 기본값 제공
  const defaultPubKey = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const pubKeyToUse = pubKey || defaultPubKey;

  // 문자열에서 바로 Uint8Array로 변환
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
  // 해시가 객체인 경우 문자열로 변환 시도
  let hashString: string;
  if (typeof hash === 'object') {
    try {
      if (hash.status) {
        hashString = hash.status;
        // 거부된 트랜잭션인 경우 즉시 오류 반환
        if (hashString === 'Rejected') {
          log.error('사용자가 트랜잭션을 거부했습니다:', hashString);
          throw new Error('사용자가 트랜잭션을 거부했습니다');
        }
      } else if (hash.hash) {
        hashString = hash.hash;
      } else {
        // 객체를 문자열로 변환
        hashString = JSON.stringify(hash);
        log.error('객체 타입의 트랜잭션 해시:', hashString);
        throw new Error('유효하지 않은 트랜잭션 해시 형식: 객체');
      }
    } catch (e) {
      log.error('트랜잭션 해시 처리 오류:', e);
      throw new Error('유효하지 않은 트랜잭션 해시 형식');
    }
  } else {
    hashString = hash;
    // 문자열이 'Rejected'인 경우 처리
    if (
      hashString === 'Rejected' ||
      hashString === 'undefined' ||
      hashString === '알 수 없는 해시'
    ) {
      log.error('유효하지 않은 트랜잭션 해시:', hashString);
      throw new Error('유효하지 않은 트랜잭션 해시입니다');
    }
  }

  // 최소한의 해시 형식 검증 (0x로 시작하고 최소 길이를 가져야 함)
  if (!hashString.startsWith('0x') || hashString.length < 10) {
    log.error('유효하지 않은 트랜잭션 해시 형식:', hashString);
    throw new Error('유효하지 않은 트랜잭션 해시 형식입니다');
  }

  log.info(`트랜잭션 결과 대기 중 (해시: ${hashString}), 최대 ${maxRetries}회 재시도...`);

  let retries = 0;
  let delayMs = initialDelayMs;

  while (retries < maxRetries) {
    try {
      const txResult: any = await getTx(hashString, chainId);
      if (txResult) {
        // 성공 여부 명시적 확인
        if (txResult.success === false) {
          const vmStatus = txResult.vm_status || '';
          let errorMsg = '';

          // VM 오류에 대한 구체적인 설명 추가
          if (vmStatus.includes('Move abort')) {
            // Move abort 오류 형식 파싱 (예: "Move abort in 0x1::util: 0x10001")
            const moduleMatch = vmStatus.match(/in ([^:]+):/);
            const codeMatch = vmStatus.match(/: (0x[0-9a-fA-F]+)/);

            const module = moduleMatch ? moduleMatch[1] : '알 수 없는 모듈';
            const errorCode = codeMatch ? codeMatch[1] : '알 수 없는 코드';

            errorMsg = `Move 컨트랙트 실행 오류: 모듈 ${module}에서 오류 코드 ${errorCode}`;

            // 특정 오류 코드에 대한 추가 설명
            if (errorCode === '0x10001' && module.includes('0x1::util')) {
              errorMsg += '. 이는 일반적으로 권한 부족이나 잘못된 입력값으로 인해 발생합니다.';
            } else if (errorCode === '0x1000A') {
              errorMsg += '. 불충분한 잔액으로 인한 오류입니다.';
            } else if (errorCode === '0x20001') {
              errorMsg += '. 리소스가 이미 존재하거나 중복 발생 오류입니다.';
            } else if (errorCode === '0x30001') {
              errorMsg += '. 필요한 리소스를 찾을 수 없습니다.';
            }
          } else if (vmStatus.includes('EXECUTION_FAILURE')) {
            errorMsg = `실행 오류: ${vmStatus}. 트랜잭션 실행 중 오류가 발생했습니다.`;
          } else if (vmStatus.includes('OUT_OF_GAS')) {
            errorMsg = '가스 부족: 트랜잭션에 충분한 가스가 제공되지 않았습니다.';
          } else {
            errorMsg = `트랜잭션 실패: ${vmStatus || '알 수 없는 오류'}`;
          }

          log.error('트랜잭션 실패:', errorMsg);
          // VM 오류 발생 시 즉시 종료하고 더 이상 재시도하지 않음
          throw new Error(errorMsg);
        }

        log.info('트랜잭션 조회 성공:', txResult);
        return txResult;
      }
      throw new Error('트랜잭션 결과가 비어있습니다');
    } catch (error: any) {
      // VM 오류인 경우 즉시 재시도 중단
      if (
        error.message &&
        (error.message.includes('Move 컨트랙트 실행 오류') ||
          error.message.includes('Move abort') ||
          error.message.includes('실행 오류') ||
          error.message.includes('가스 부족'))
      ) {
        log.error('VM 오류 발생으로 재시도 중단:', error.message);
        throw error; // VM 오류는 재시도해도 결과가 바뀌지 않으므로 바로 오류 전파
      }

      retries++;

      // 특정 오류 조건에서 즉시 실패 처리 (예: 잘못된 해시 형식)
      if (error.message && error.message.includes('Invalid hash')) {
        log.error('잘못된 트랜잭션 해시 형식:', error);
        throw error;
      }

      if (retries >= maxRetries) {
        log.error(`최대 재시도 횟수(${maxRetries})에 도달했습니다.`);
        throw new Error(`트랜잭션 확인 실패: ${error.message || '알 수 없는 오류'}`);
      }

      // 지수 백오프 적용 (최대 30초까지)
      delayMs = Math.min(delayMs * 1.5, 30000);

      log.info(
        `트랜잭션이 아직 처리 중입니다. ${delayMs}ms 후 재시도 (${retries}/${maxRetries})...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('트랜잭션 조회 시간 초과');
}
