import { log } from '../../utils/logger';
import { ensureBigInt, ensureNumber } from '../sui/transaction_builder/builder_utils';
import { CompiledModulesAndDeps } from 'wds-event';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64, normalizeSuiObjectId } from '@mysten/sui/utils';
import {
  SuiClient,
  SuiTransactionBlockResponse,
  SuiMoveNormalizedType,
  SuiObjectData,
} from '@mysten/sui/client';
import { MovementFunc, MovementModule } from './movement-types';
import { delay } from '../near/utils/waitForTransaction';
import yaml from 'js-yaml';

export type MovementChainId = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const MOVEMENT_RPC_ENDPOINTS = {
  mainnet: 'https://fullnode.mainnet.movement.com',
  testnet: 'https://fullnode.testnet.movement.com',
  devnet: 'https://fullnode.devnet.movement.com',
  localnet: 'http://127.0.0.1:9000',
};

export async function dappPublishTxn(
  accountId: string,
  chainId: MovementChainId,
  compiledModulesAndDeps: CompiledModulesAndDeps,
  gas: number,
) {
  const tx = new Transaction();
  tx.setGasBudget(gas);
  const cap = tx.publish({
    modules: compiledModulesAndDeps.modules.map((m: any) => Array.from(fromB64(m))),
    dependencies: compiledModulesAndDeps.dependencies.map((addr: string) =>
      normalizeSuiObjectId(addr),
    ),
  });
  tx.transferObjects([cap], tx.pure.address(accountId));
  tx.setSender(accountId);
  return tx.serialize();
}

export async function moveCallTxn(
  client: any,
  accountId: string,
  chainId: MovementChainId,
  packageId: string,
  moduleName: string,
  func: MovementFunc,
  typeArgs: string[],
  args: any[],
  gas: number,
) {
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
  return tx.serialize();
}

const PROVIDER_MAINNET = new SuiClient({
  url: MOVEMENT_RPC_ENDPOINTS.mainnet,
});

const PROVIDER_TESTNET = new SuiClient({
  url: MOVEMENT_RPC_ENDPOINTS.testnet,
});

const PROVIDER_DEVNET = new SuiClient({
  url: MOVEMENT_RPC_ENDPOINTS.devnet,
});

const PROVIDER_LOCALNET = new SuiClient({
  url: MOVEMENT_RPC_ENDPOINTS.localnet,
});

export function getProvider(chainId: MovementChainId): SuiClient {
  switch (chainId) {
    case 'mainnet':
      return PROVIDER_MAINNET;
    case 'testnet':
      return PROVIDER_TESTNET;
    case 'devnet':
      return PROVIDER_DEVNET;
    case 'localnet':
      return PROVIDER_LOCALNET;
    default:
      throw new Error(`Invalid ChainId=${chainId}`);
  }
}

export async function waitForTransactionWithResult(
  txnHash: string[],
  chainId: MovementChainId,
): Promise<SuiTransactionBlockResponse> {
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
        return result;
      }
    } catch (e) {
      console.error(e);
    }
    await delay(5_000);
  }
  throw new Error(`movement client getTransactionBlock fail.`);
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

export async function getModules(
  chainId: MovementChainId,
  packageId: string,
): Promise<MovementModule[]> {
  log.info(`[getModules] chainId=${chainId}, packageId=${packageId}`);
  const movementMoveNormalizedModules = await getProvider(
    chainId,
  ).getNormalizedMoveModulesByPackage({
    package: packageId,
  });

  return Object.keys(movementMoveNormalizedModules).map((moduleName) => {
    const module = movementMoveNormalizedModules[moduleName];
    const movementFuncs = Object.keys(module.exposedFunctions).map((funcName) => {
      const func = module.exposedFunctions[funcName];
      return {
        name: funcName,
        ...func,
      };
    });

    const movementStructs = Object.keys(module.structs).map((structName) => {
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
      exposedFunctions: movementFuncs,
      structs: movementStructs,
    };
  });
}

export async function getPackageIds(account: string, chainId: MovementChainId): Promise<string[]> {
  const provider = getProvider(chainId);
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
  chainId: MovementChainId,
): Promise<SuiObjectData[]> {
  const provider = await getProvider(chainId);
  log.info('getOwnedObjects account', account);
  const { data: movementObjectResponses } = await provider.getOwnedObjects({
    owner: account,
    options: {
      showType: true,
      showContent: true,
      showOwner: true,
      showDisplay: true,
    },
  });
  return movementObjectResponses
    .map((d) => d.data)
    .filter((d): d is SuiObjectData => {
      return !(d === null || d === undefined);
    });
}

export function parseYaml(str: string) {
  return yaml.load(str);
}

export function initGenericParameters(typeParameters: any[]) {
  return new Array(typeParameters.length);
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
