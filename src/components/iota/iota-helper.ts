import { log } from '../../utils/logger';
import { ensureBigInt, ensureNumber } from './transaction_builder/builder_utils';
import { CompiledModulesAndDeps } from 'wds-event';
import { fromB64, normalizeSuiObjectId } from '@mysten/sui/utils';

import {
  getFullnodeUrl,
  IotaClient,
  IotaMoveNormalizedType,
  IotaObjectData,
  IotaTransactionBlockResponse,
  Network,
} from '@iota/iota-sdk/client';
import { IotaFunc, IotaModule } from './iota-types';
import { delay } from '../near/utils/waitForTransaction';
import { Transaction } from '@iota/iota-sdk/transactions';

const yaml = require('js-yaml');
export type IotaChainId = 'mainnet' | 'testnet' | 'devnet';

// 트랜잭션 반환 타입 정의
export interface DappPublishTxnReturnType {
  serialized: string;
  jsonData: any;
  toString: () => string;
  toJSON: () => any;
}

export const dappPublishTxn = async (
  accountID: string,
  chainId: IotaChainId,
  compiledModulesAndDeps: CompiledModulesAndDeps,
  gas: number,
): Promise<DappPublishTxnReturnType> => {
  console.log('dappPublishTxn 호출됨', { accountID, chainId, compiledModulesAndDeps, gas });

  try {
    // Transaction 객체 생성
    const tx = new Transaction();

    // 발송자 설정
    tx.setSender(accountID);

    // 가스 예산 설정
    tx.setGasBudget(gas);

    // 모듈 발행
    const [upgradeCap] = tx.publish({
      modules: compiledModulesAndDeps.modules.map((m: any) => Array.from(fromB64(m))),
      dependencies: compiledModulesAndDeps.dependencies.map((addr: string) =>
        normalizeSuiObjectId(addr),
      ),
    });
    console.log('upgradeCap', upgradeCap);

    // 업그레이드 기능을 발송자에게 전송
    tx.transferObjects([upgradeCap], tx.pure.address(accountID));

    // 트랜잭션 JSON 데이터 얻기
    const client = getProvider(chainId);
    const jsonData = await tx.build({ client });

    console.log('jsonData', jsonData);
    // 트랜잭션 직렬화
    const serialized = tx.serialize();

    // 반환 객체 생성
    const txData = {
      serialized,
      jsonData,
      toString: () => serialized,
      toJSON: () => jsonData,
    };

    console.log('트랜잭션 생성 완료:', {
      sender: accountID,
      hasUpgradeCap: !!upgradeCap,
      serializedSize: serialized.length,
    });

    return txData as DappPublishTxnReturnType;
  } catch (error) {
    console.error('트랜잭션 생성 중 오류 발생:', error);
    throw error;
  }
};

export async function moveCallTxn(
  client: any,
  accountId: string,
  chainId: IotaChainId,
  packageId: string,
  moduleName: string,
  func: IotaFunc,
  typeArgs: string[],
  args: any[],
  gas: number,
) {
  console.log('moduleName', moduleName);

  log.info('args', JSON.stringify(args, null, 2));
  await client.terminal.log({
    type: 'info',
    value:
      '--------------------------- Tx Arguments ---------------------------\n\n' +
      `${JSON.stringify(args, null, 2)}` +
      '\n\n--------------------------------------------------------------------',
  });
  log.debug('gas', gas);
  const tx = new Transaction();
  tx.setSender(accountId);
  // TODO: Publish dry runs fail currently, so we need to set a gas budget:
  tx.setGasBudget(gas);

  const moveCallInput = {
    target: `${packageId}::${moduleName}::${func.name}`,
    typeArguments: typeArgs,
    arguments: args.map((arg, i) => {
      const parameter: any = func.parameters[i];
      if (
        parameter.Vector?.Struct &&
        !(
          parameter.Vector.Struct.address === '0x1' &&
          parameter.Vector.Struct.module === 'string' &&
          parameter.Vector.Struct.name === 'String'
        )
      ) {
        return tx.makeMoveVec({
          elements: arg.map((a: any) => tx.pure(a)),
        });
      } else if (parameter === 'Bool') {
        return tx.pure.u8(arg);
      } else if (parameter === 'U8') {
        return tx.pure.u8(arg);
      } else if (parameter === 'U16') {
        return tx.pure.u16(arg);
      } else if (parameter === 'U32') {
        return tx.pure.u32(arg);
      } else if (parameter === 'U64') {
        return tx.pure.u64(arg);
      } else if (parameter === 'U128') {
        return tx.pure.u128(arg);
      } else if (parameter === 'U256') {
        return tx.pure.u256(arg);
      } else if (parameter.MutableReference?.Struct) {
        return tx.object(arg);
      } else if (parameter === 'Address') {
        return tx.pure.address(arg);
      }
    }),
  };
  log.info('moveCallInput', moveCallInput);
  tx.moveCall(moveCallInput as any);

  // myTokensObject1Vec = tx.makeMoveVec({
  //   objects: [tx.pure(myTokenObjects1[0]), tx.pure(myTokenObjects1[1])],
  // });
  // const myTokensObject2Vec = tx.makeMoveVec({
  //   objects: [tx.pure(myTokenObjects2[0]), tx.pure(myTokenObjects2[1])],
  // });
  // tx.moveCall({
  //   typeArguments: [typeInfo1, typeInfo2],
  //   target: some_target,
  //   arguments: [
  //     myTokensObject1Vec, // here are the vec params
  //     myTokensObject2Vec, // here are the vec params
  //   ],
  // });

  log.info('tx', tx);
  return tx.serialize();
}

const PROVIDER_MAINNET = new IotaClient({
  url: getFullnodeUrl(Network.Mainnet),
});

const PROVIDER_TESTNET = new IotaClient({
  url: getFullnodeUrl(Network.Testnet),
});

const PROVIDER_DEVNET = new IotaClient({
  url: getFullnodeUrl(Network.Devnet),
});

export function getProvider(chainId: IotaChainId): IotaClient {
  if (chainId === 'mainnet') {
    return PROVIDER_MAINNET;
  }

  if (chainId === 'testnet') {
    return PROVIDER_TESTNET;
  }

  if (chainId === 'devnet') {
    return PROVIDER_DEVNET;
  }

  throw new Error(`Invalid ChainId=${chainId}`);
}

export async function waitForTransactionWithResult(
  txnHash: string[],
  chainId: IotaChainId,
): Promise<IotaTransactionBlockResponse> {
  console.log('waitForTransactionWithResult 시작:', txnHash, chainId);
  await delay(5_000);
  const client = getProvider(chainId);
  log.info(`getTransactionBlock txHash`, txnHash);
  const try_num = 3;
  let result;
  for (let i = 0; i < try_num; i++) {
    try {
      log.info(`Trying getTransactionBlock n=${i + 1}.`);
      result = await client.getTransactionBlock({
        digest: txnHash[0],
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
        },
      });
      if (result) {
        console.log('트랜잭션 결과 성공:', result);
        return result;
      }
    } catch (e) {
      console.error(`트랜잭션 결과 조회 시도 ${i + 1} 실패:`, e);
    }
    console.log(`${i + 1}번째 시도 실패, 5초 후 다시 시도...`);
    await delay(5_000);
  }
  throw new Error(`iota client getTransactionBlock 요청 실패. txHash: ${txnHash[0]}`);
}

export function parseArgVal(argVal: any, argType: string, u8parseType?: string) {
  log.info(`### parseArgVal argVal=${argVal}, argType=${argType}, u8parseType=${u8parseType}`);
  if (argType === 'Bool') {
    return argVal;
  }

  if (argType === 'U8') {
    if (u8parseType === 'string') {
      return argVal;
    }

    if (u8parseType === 'hex') {
      return argVal;
    }

    return ensureNumber(argVal);
  }

  if (argType === 'U8' || argType === 'U16' || argType === 'U32') {
    return ensureNumber(argVal);
  }

  if (argType === 'U64' || argType === 'U128' || argType === 'U256') {
    return ensureBigInt(argVal).toString();
  }

  if (argType === 'Address') {
    return argVal;
  }

  return argVal;
}

export async function getModules(chainId: IotaChainId, packageId: string): Promise<IotaModule[]> {
  log.info(`[getModules] chainId=${chainId}, packageId=${packageId}`);
  const iotaMoveNormalizedModules = await getProvider(chainId).getNormalizedMoveModulesByPackage({
    package: packageId,
  });

  return Object.keys(iotaMoveNormalizedModules).map((moduleName) => {
    const module = iotaMoveNormalizedModules[moduleName];
    const iotaFuncs = Object.keys(module.exposedFunctions).map((funcName) => {
      const func = module.exposedFunctions[funcName];
      return {
        name: funcName,
        ...func,
      };
    });

    const iotaStructs = Object.keys(module.structs).map((structName) => {
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
      exposedFunctions: iotaFuncs,
      structs: iotaStructs,
    };
  });
}

export async function getPackageIds(account: string, chainId: string): Promise<string[]> {
  const provider = getProvider(chainId as IotaChainId);
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
  chainId: IotaChainId,
): Promise<IotaObjectData[]> {
  const provider = await getProvider(chainId);
  log.info('getOwnedObjects account', account);
  const { data: iotaObjectResponses } = await provider.getOwnedObjects({
    owner: account,
    options: {
      showType: true,
      showContent: true,
      showOwner: true,
      showDisplay: true,
    },
  });
  return iotaObjectResponses
    .map((d) => d.data)
    .filter((d): d is IotaObjectData => {
      return !(d === null || d === undefined);
    });
}

export function parseYaml(str: string) {
  return yaml.load(str);
}

export function initGenericParameters(typeParameters: any[]) {
  return new Array(typeParameters.length);
}

export function initParameters(parameters: IotaMoveNormalizedType[]) {
  return new Array(txCtxRemovedParametersLen(parameters));
}

export function txCtxRemovedParametersLen(parameters: IotaMoveNormalizedType[]) {
  return parameters.filter(
    (p: any, index: number) => !(index === parameters.length - 1 && isTxCtx(p)),
  ).length;
}

export function txCtxRemovedParameters(parameters: IotaMoveNormalizedType[]) {
  console.log('txCtxRemovedParameters parameters', parameters);
  return parameters.filter(
    (p: any, index: number) => !(index === parameters.length - 1 && isTxCtx(p)),
  );
}

function isTxCtx(p: any) {
  return (
    (p.MutableReference?.Struct?.address === '0x2' &&
      p.MutableReference?.Struct?.module === 'tx_context' &&
      p.MutableReference?.Struct?.name === 'TxContext') ||
    (p.Reference?.Struct?.address === '0x2' &&
      p.Reference?.Struct?.module === 'tx_context' &&
      p.Reference?.Struct?.name === 'TxContext')
  );
}

export const getNetworkInfo = (chainId: string) => {
  const chainIdLower = chainId.toLowerCase();
  if (chainIdLower.includes('mainnet')) {
    return {
      name: 'Mainnet',
      network: 'mainnet',
      url: 'https://api.mainnet.iota.cafe',
    };
  }

  if (chainIdLower.includes('devnet')) {
    return {
      name: 'Devnet',
      network: 'devnet',
      url: 'https://api.devnet.iota.cafe',
    };
  }

  return {
    name: 'Testnet',
    network: 'testnet',
    url: 'https://api.testnet.iota.cafe',
  };
};
