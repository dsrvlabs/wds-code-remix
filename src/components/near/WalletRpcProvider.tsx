import { RequestParams, ProviderProxy } from 'near-api-js/lib/providers/wallet-rpc-provider';

export class Provider implements ProviderProxy {
  async getAccount() {
    const result = await window.dapp.request('near', { method: 'dapp:accounts' });
    return result['near'] ? result['near'] : '';
  }

  async getBalance(accountId: string) {
    return await window.dapp.request('near', {
      method: 'dapp:getBalance',
      params: [accountId],
    });
  }

  async request(args: RequestParams) {
    if (args.method === 'signAndSendTransaction') {
      args.method = 'dapp:signAndSendTransaction';
    }
    return await window.dapp.request('near', args);
  }

  on(message: string, listener: (...args: any[]) => void) {
    window.dapp.on(message, listener);
  }

  async getNetwork() {
    const status = await window.dapp.request('near', { method: 'status', params: [] });
    return status.chain_id;
  }
}
