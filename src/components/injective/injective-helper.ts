import { TxGrpcApi, createTransaction } from '@injectivelabs/sdk-ts';

export async function simulateInjectiveTx(
  grpcEndpoint: string,
  pubKey: string,
  chainId: string,
  messages: any,
  sequence: number,
  accoutNumber: number,
) {
  const txGrpcClient = new TxGrpcApi(grpcEndpoint);
  const { txRaw } = createTransaction({
    pubKey: pubKey,
    chainId: chainId,
    message: messages,
    sequence: sequence,
    accountNumber: accoutNumber,
  });
  const response = await txGrpcClient.simulate(txRaw);
  console.log('@@ Simulated Gas Fee: ' + response.gasInfo.gasUsed);
  const muliplier = 1.1;
  return response.gasInfo.gasUsed * muliplier;
}
