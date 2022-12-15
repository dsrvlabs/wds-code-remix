import React, { useState } from 'react';
import { Button, Card, InputGroup } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { sha3_256 } from 'js-sha3';
import { AptosClient, BCS, HexString, TxnBuilderTypes } from 'aptos';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';

interface InterfaceProps {
  wallet: string;
  accountID: string;
  metaData64: string;
  moduleBase64: string;
  rawTx: string;
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  metaData64,
  moduleBase64,
  rawTx,
  wallet,
  dapp,
}) => {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('');
  const checkExistContract = async () => {
    if (!dapp) {
      throw new Error('Wallet is not installed');
    }

    if (!accountID) {
      throw new Error('No accountID');
    }

    if (wallet !== 'Dsrv') {
      throw new Error('Wallet is not Dsrv');
    }

    if (!(metaData64 && moduleBase64)) {
      throw new Error('Not prepared metadata and module');
    }

    await dsrvProceed();
  };

  const dsrvProceed = async () => {
    setInProgress(true);
    sendCustomEvent('deploy', {
      event_category: 'aptos',
      method: 'deploy',
    });
    if (!dapp) {
      return;
    }

    try {
      setDeployIconSpin('fa-spin');
      const chainId = dapp.networks.aptos.chain;
      const rawTx_ = await genRawTx(
        Buffer.from(metaData64, 'base64'),
        Buffer.from(moduleBase64, 'base64'),
        accountID,
        chainId,
      );
      const txnHash = await dapp.request('aptos', {
        method: 'dapp:sendTransaction',
        params: [rawTx_],
      });
      log.debug(`@@@ txnHash=${txnHash}`);
      const result = await waitForTransactionWithResult(txnHash, chainId);
      log.debug(result);
    } catch (e: any) {
      log.error(e);
      await client.terminal.log({ type: 'error', value: e?.message?.toString() });
    }
    setInProgress(false);
    setDeployIconSpin('');
    setInProgress(false);
  };

  return (
    <>
      <Card>
        <Card.Header className="p-2">
          Deploy <FaSyncAlt className={deployIconSpin} />
        </Card.Header>
        <Card.Body className="py-1 px-2">
          <InputGroup className="mb-3">
            <Button
              variant="warning"
              size="sm"
              onClick={async () => {
                try {
                  await checkExistContract();
                } catch (e) {
                  log.error(e);
                  setInProgress(false);
                }
              }}
              disabled={inProgress || !rawTx}
            >
              <small>Deploy</small>
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>
    </>
  );
};

async function genRawTx(
  packageMetadataBuf: Buffer,
  moduleDataBuf: Buffer,
  accountID: string,
  chainId: string,
) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));

  const packageMetadata = new HexString(packageMetadataBuf.toString('hex')).toUint8Array();
  const modules = [
    new TxnBuilderTypes.Module(new HexString(moduleDataBuf.toString('hex')).toUint8Array()),
  ];

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
  const header = Buffer.from(sha3_256(Buffer.from('APTOS::RawTransaction', 'ascii')), 'hex');
  return header.toString('hex') + _transaction;
}

async function waitForTransactionWithResult(txnHash: string, chainId: string) {
  const aptosClient = new AptosClient(aptosNodeUrl(chainId));
  return aptosClient.waitForTransactionWithResult(txnHash);
}

function aptosNodeUrl(chainId: string) {
  if (chainId === 'testnet') {
    return 'https://fullnode.testnet.aptoslabs.com';
  } else if (chainId === 'devnet') {
    return 'https://fullnode.devnet.aptoslabs.com';
  } else {
    throw new Error(`Invalid chainId=${chainId}`);
  }
}
