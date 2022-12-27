// Note: temporary helper utils. delete after wallet update.
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const waitForTransaction = async (txHash: string, address: string, near: any) => {
  let isPending = true;
  let count = 0;
  while (isPending) {
    if (count >= 10) {
      break;
    }
    try {
      const receipt = await near.connection.provider.txStatus(txHash, address);
      return receipt;
    } catch (e) {
      await delay(1000);
      count += 1;
    }
  }
  throw new Error(`Waiting for transaction ${txHash} timed out!`);
};
