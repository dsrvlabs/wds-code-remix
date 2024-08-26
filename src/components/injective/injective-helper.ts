import { PubKey, TxGrpcApi, createTransaction } from '@injectivelabs/sdk-ts';

export async function simulateInjectiveTx(
  grpcEndpoint: string,
  pubKey: PubKey,
  chainId: string,
  messages: any,
  sequence: number,
  accoutNumber: number,
) {
  const txGrpcClient = new TxGrpcApi(grpcEndpoint);
  const { txRaw } = createTransaction({
    pubKey: pubKey.key,
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

// export const getEthereumWalletPubKey = <T>({
//   pubKey,
//   eip712TypedData,
//   signature,
// }: {
//   pubKey?: string;
//   eip712TypedData: T;
//   signature: string;
// }) => {
//   if (pubKey) {
//     return pubKey;
//   }

//   return hexToBase64(recoverTypedSignaturePubKey(eip712TypedData, signature));
// };
