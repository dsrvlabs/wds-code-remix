import { utils, providers, transactions, Near } from 'near-api-js';
import { RenderTransactions } from '../RenderTransactions';
import { renderToString } from 'react-dom/server';
import BN from 'bn.js';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { waitForTransaction } from './waitForTransaction';
import { log } from '../../../utils/logger';

export const fetchData = async (rpcUrl: string, accountId: string, pubKey: string) => {
  const fetchResult = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'dontcare',
      method: 'query',
      params: {
        request_type: 'view_access_key_list',
        finality: 'final',
        account_id: accountId,
      },
    }),
  });
  const data = await fetchResult.json();
  const key = data.result.keys.filter((key: any) => key['public_key'] === pubKey);
  const nonce = key[0]['access_key'].nonce + 1;
  const recentBlockHash = utils.serialize.base_decode(data.result.block_hash);
  return { nonce: nonce, recentBlockHash: recentBlockHash };
};

export const callMethod = async (
  rpcUrl: string,
  account: { address: string; pubKey: string },
  walletRpcProvider: providers.WalletRpcProvider,
  contractId: string,
  methodName: string,
  params: any,
  deposit: string | number,
  gasLimit: number,
  client: Client<Api, Readonly<IRemixApi>>,
  nearConfig: Near | undefined,
) => {
  try {
    if (!nearConfig) {
      throw new Error('near connection undefined');
    }
    const { nonce, recentBlockHash } = await fetchData(rpcUrl, account.address, account.pubKey);
    const actions = [
      transactions.functionCall(methodName, params, new BN(gasLimit), new BN(deposit)),
    ];
    const transaction = transactions.createTransaction(
      account.address, // sender_id
      utils.PublicKey.fromString(account.pubKey),
      contractId, // receiver_id
      nonce,
      actions,
      recentBlockHash,
    );
    // TODO: modify to using walletRpcProvider after wallet update
    const txHash = await (window as any).dapp.request('near', {
      method: 'dapp:signAndSendTransaction',
      params: [Buffer.from(transaction.encode()).toString('base64')],
    });
    log.debug('near txHash:', txHash);
    const receipt = await waitForTransaction(txHash[0], account.address, nearConfig);
    // const receipt = await walletRpcProvider.signAndSendTransaction(transaction);

    if ((receipt.status as providers.FinalExecutionStatus).Failure) {
      await client.terminal.log({
        type: 'error',
        value: (receipt.status as providers.FinalExecutionStatus).Failure,
      });
    } else {
      const callResult = (
        <RenderTransactions
          nonce={receipt.transaction.nonce}
          signer={receipt.transaction.signer_id}
          receiver={receipt.transaction.receiver_id}
          value={receipt.transaction.actions[0].FunctionCall.deposit}
          receipt={receipt.receipts_outcome[0].id}
          logs={receipt.receipts_outcome[0].outcome.logs.toString()}
          hash={receipt.transaction.hash}
          gasBurnt={receipt.receipts_outcome[0].outcome.gas_burnt}
        />
      );
      await (client as any).call('terminal', 'logHtml', {
        type: 'html',
        value: renderToString(callResult),
      });
    }
  } catch (e: any) {
    throw new Error(e?.message?.toString());
  }
};
