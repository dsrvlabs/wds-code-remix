import { utils, providers, transactions, Near } from 'near-api-js';
import { RenderTransactions } from '../RenderTransactions';
import { renderToString } from 'react-dom/server';
import BN from 'bn.js';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { fetchData } from './callMethod';
import { log } from '../../../utils/logger';
import { waitForTransaction } from './waitForTransaction';

export const deployContract = async (
  rpcUrl: string,
  account: { address: string; pubKey: string },
  walletRpcProvider: providers.WalletRpcProvider,
  wasm: string,
  contractId: string,
  client: Client<Api, Readonly<IRemixApi>>,
  nearConfig: Near | undefined,
  methodName?: string,
  params?: any,
  deposit?: string | number,
) => {
  try {
    if (!nearConfig) {
      throw new Error('near connection undefined');
    }
    const { nonce, recentBlockHash } = await fetchData(rpcUrl, account.address, account.pubKey);
    const array = Buffer.from(wasm, 'base64');
    const actions = [transactions.deployContract(array)];

    // deploy contract with init function
    if (methodName && deposit) {
      actions.push(
        transactions.functionCall(
          methodName,
          params,
          new BN(30000000000000), // 30TGas
          new BN(deposit),
        ),
      );
    }

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
      return;
    } else {
      const callResult = (
        <RenderTransactions
          nonce={receipt.transaction.nonce}
          signer={receipt.transaction.signer_id}
          receiver={receipt.transaction.receiver_id}
          value={
            receipt.transaction.actions.length === 2
              ? receipt.transaction.actions[1].FunctionCall.deposit
              : '0'
          }
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
    return receipt;
  } catch (e: any) {
    throw new Error(e?.message?.toString());
  }
};
