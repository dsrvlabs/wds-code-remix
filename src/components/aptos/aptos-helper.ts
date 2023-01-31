import { AptosClient, BCS, HexString, TxnBuilderTypes, TransactionBuilderRemoteABI } from 'aptos';
import { sha3_256 } from 'js-sha3';
import { log } from '../../utils/logger';

export async function genRawTx(
  base64EncodedMetadata: string,
  base64EncodedModules: string[],
  accountID: string,
  chainId: string,
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
  );

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

export async function build(func: string, ty_tags: string[], args: string[], chainId: string, abiBuilderConfig: any) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  const transactionBuilderRomoteABI = new TransactionBuilderRemoteABI(aptosClient, abiBuilderConfig);
  const rawTransaction = await transactionBuilderRomoteABI.build(func, ty_tags, args);

  const rawTx = BCS.bcsToBytes(rawTransaction);
  const _transaction = Buffer.from(rawTx).toString('hex');
  log.debug('_transaction', _transaction);
  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return '0x' + header.toString('hex') + _transaction;
}

export async function getAccountModules(account: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  const modules = await aptosClient.getAccountModules(account)
  return modules;
}

export async function viewFunction(account: string, moduleName: string, functionName: string, chainId: string, typeArg: [], param: any) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const payload = {
    function: account + "::" + moduleName + "::" + functionName,
    type_arguments: typeArg,
    arguments: param,
  };

  log.debug(payload)

  return await aptosClient.view(payload);
}

export function aptosNodeUrl(chainId: string) {
  if (chainId === 'testnet') {
    return 'https://fullnode.testnet.aptoslabs.com';
  } else if (chainId === 'devnet') {
    return 'https://fullnode.devnet.aptoslabs.com';
  } else {
    throw new Error(`Invalid chainId=${chainId}`);
  }
}
