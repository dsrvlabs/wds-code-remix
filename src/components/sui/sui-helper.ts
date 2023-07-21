import { log } from '../../utils/logger';
import { ensureBigInt, ensureNumber } from './transaction_builder/builder_utils';
import { CompiledModulesAndDeps } from 'wds-event';
import {
  Connection,
  fromB64,
  JsonRpcProvider,
  normalizeSuiObjectId,
  TransactionBlock,
} from '@mysten/sui.js';
import { SuiModule, SuiFunc } from './sui-types';
import { SuiObjectData } from '@mysten/sui.js/src/types/objects';
import { SuiMoveNormalizedType } from '@mysten/sui.js/dist/types/normalized';
import { delay } from '../near/utils/waitForTransaction';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { SuiDeployHistoryCreateDto } from './Deploy';
const yaml = require('js-yaml');
export type SuiChainId = 'mainnet' | 'testnet' | 'devnet';

export async function dappPublishTxn(
  accountId: string,
  chainId: SuiChainId,
  compiledModulesAndDeps: CompiledModulesAndDeps,
  gas: number,
) {
  const tx = new TransactionBlock();
  // TODO: Publish dry runs fail currently, so we need to set a gas budget:
  tx.setGasBudget(gas);
  const cap = tx.publish({
    modules: compiledModulesAndDeps.modules.map((m: any) => Array.from(fromB64(m))),
    dependencies: compiledModulesAndDeps.dependencies.map((addr: string) =>
      normalizeSuiObjectId(addr),
    ),
  });
  tx.transferObjects([cap], tx.pure(accountId));
  tx.setSender(accountId);
  return tx.serialize();
}

export async function moveCallTxn(
  client: any,
  accountId: string,
  chainId: SuiChainId,
  packageId: string,
  moduleName: string,
  func: SuiFunc,
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
  const tx = new TransactionBlock();
  tx.setSender(accountId);
  // TODO: Publish dry runs fail currently, so we need to set a gas budget:
  tx.setGasBudget(gas);

  const moveCallInput = {
    target: `${packageId}::${moduleName}::${func.name}`,
    typeArguments: typeArgs,
    arguments: args.map((arg, i) => {
      const parameter: any = func.parameters[i];
      if (parameter.Vector?.Struct) {
        return tx.makeMoveVec({
          objects: arg.map((a: any) => tx.pure(a)),
        });
      }
      return tx.pure(arg);
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

const PROVIDER_MAINNET = new JsonRpcProvider(
  new Connection({
    fullnode: 'https://fullnode.mainnet.sui.io:443/',
    faucet: 'https://faucet.mainnet.sui.io/gas',
  }),
);

const PROVIDER_TESTNET = new JsonRpcProvider(
  new Connection({
    fullnode: 'https://fullnode.testnet.sui.io:443/',
    faucet: 'https://faucet.testnet.sui.io/gas',
  }),
);

const PROVIDER_DEVNET = new JsonRpcProvider(
  new Connection({
    // fullnode: 'https://fullnode.devnet.sui.io:443/',
    fullnode: 'https://wallet-rpc.devnet.sui.io/',
    faucet: 'https://faucet.devnet.sui.io/gas',
  }),
);

export function getProvider(chainId: SuiChainId): JsonRpcProvider {
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
  txnHash: string,
  chainId: SuiChainId,
  accountID: string = '',
  packageName: string = '',
  compileTimestamp: number = 0,
  uploadCodeChecked = false,
) {
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
        break;
      }
    } catch (e) {
      log.error(e);
    }
    await delay(5_000);
  }

  if (!result) {
    const suiDeployHistoryCreateTimeoutDto: SuiDeployHistoryCreateDto = {
      chainId: chainId,
      account: accountID,
      packageId: '',
      packageName: packageName,
      compileTimestamp: Number(compileTimestamp),
      deployTimestamp: 0,
      txHash: txnHash,
      isSrcUploaded: uploadCodeChecked,
      status: null,
      modules: [''],
    };
    log.info('suiDeployHistoryCreateTimeoutDto', suiDeployHistoryCreateTimeoutDto);

    try {
      const res = await axios.post(
        COMPILER_API_ENDPOINT + '/sui-deploy-histories',
        suiDeployHistoryCreateTimeoutDto,
      );
      log.info(`sui-deploy-histories api res`, res);
    } catch (e) {
      log.error(`sui-deploy-histories api error`);
    }
    throw new Error(`getTransactionBlock error. txnHash=${txnHash[0]}, chainId=${chainId}`);
  }

  log.info(`TransactionBlock`, result);
  return result;
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

export async function getModules(chainId: SuiChainId, packageId: string): Promise<SuiModule[]> {
  log.info(`[getModules] chainId=${chainId}, packageId=${packageId}`);
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
  log.info('getOwnedObjects account', account);
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
