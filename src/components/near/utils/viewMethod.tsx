import { Near } from 'near-api-js';
import { ViewResult } from '../RenderTransactions';
import { renderToString } from 'react-dom/server';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';

export const viewMethod = async (
  near: Near,
  contractId: string,
  methodName: string,
  params: any,
  client: Client<Api, Readonly<IRemixApi>>,
) => {
  try {
    const account = await near.account('');
    const result = await account.viewFunction(contractId, methodName, params);
    const viewResult = (
      <ViewResult
        result={result}
        from={contractId}
        to={methodName}
        hash={`view_${contractId}_${methodName}`}
      />
    );
    await (client as any).call('terminal', 'logHtml', {
      type: 'html',
      value: renderToString(viewResult),
    });
  } catch (e: any) {
    throw new Error(e?.message?.toString());
  }
};
