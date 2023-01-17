import { AptosClient, BCS, HexString, TxnBuilderTypes } from 'aptos';
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
