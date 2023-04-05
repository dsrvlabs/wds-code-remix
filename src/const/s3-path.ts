export class S3Path {
  static bucket() {
    return 'wds-code-build';
  }

  static outKey(
    chainName: string,
    chainId: string,
    account: string,
    timestamp: string,
    filetype: string,
  ) {
    return `${chainName}/${chainId}/${account}/${timestamp}/out_${account}_${timestamp}_${filetype}.zip`;
  }
}