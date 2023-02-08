import {
  AptosClient,
  BCS,
  HexString,
  TransactionBuilderRemoteABI,
  TxnBuilderTypes,
  Types,
} from 'aptos';
import { sha3_256 } from 'js-sha3';
import { log } from '../../utils/logger';

export interface ViewResult {
  result?: Types.MoveValue;
  error: string;
}

export async function genRawTx(
  base64EncodedMetadata: string,
  base64EncodedModules: string[],
  accountID: string,
  chainId: string,
  maxGasAmount: number,
  gasUnitPrice: number,
) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const packageMetadata = new HexString(
    Buffer.from(base64EncodedMetadata, 'base64').toString('hex'),
  ).toUint8Array();

  const modules = base64EncodedModules
    .map((module) => Buffer.from(module, 'base64'))
    .map((buf) => new TxnBuilderTypes.Module(new HexString(buf.toString('hex')).toUint8Array()));

  const codeSerializer = new BCS.Serializer();
  BCS.serializeVector(modules, codeSerializer);

  const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      '0x1::code',
      'publish_package_txn',
      [],
      [BCS.bcsSerializeBytes(packageMetadata), codeSerializer.getBytes()],
    ),
  );

  const rawTransaction = await aptosClient.generateRawTransaction(
    new HexString(accountID),
    payload,
    {
      maxGasAmount: BigInt(maxGasAmount),
      gasUnitPrice: BigInt(gasUnitPrice),
    },
  );

  console.log(rawTransaction);

  const rawTx = BCS.bcsToBytes(rawTransaction);
  const _transaction = Buffer.from(rawTx).toString('hex');
  log.debug('_transaction', _transaction);
  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return '0x' + header.toString('hex') + _transaction;
}

export async function waitForTransactionWithResult(txnHash: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return aptosClient.waitForTransactionWithResult(txnHash);
}

export async function build(
  func: string,
  ty_tags: string[],
  args: string[],
  chainId: string,
  abiBuilderConfig: any,
) {
  log.debug('@@@ setMsg build', {
    func,
    ty_tags,
    args,
    chainId,
    abiBuilderConfig,
  });
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  const transactionBuilderRomoteABI = new TransactionBuilderRemoteABI(
    aptosClient,
    abiBuilderConfig,
  );
  const rawTransaction = await transactionBuilderRomoteABI.build(func, ty_tags, args);

  const rawTx = BCS.bcsToBytes(rawTransaction);
  const _transaction = Buffer.from(rawTx).toString('hex');
  log.debug('_transaction', _transaction);
  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return '0x' + header.toString('hex') + _transaction;
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
  param: any,
): Promise<ViewResult> {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const payload = {
    function: account + '::' + moduleName + '::' + functionName,
    type_arguments: typeArg,
    arguments: param,
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
