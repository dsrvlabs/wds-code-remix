import React, { useState } from 'react';
import { Button, Form, Form as ReactForm } from 'react-bootstrap';
import { StargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { log } from '../../utils/logger';
import Editor from '@monaco-editor/react';

interface InterfaceProps {
  contractAddress: string;
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({ contractAddress }) => {
  const [queryMsg, setQueryMsg] = useState(`${JSON.stringify({ msg: {} }, null, 2)}`);
  const [queryMsgErr, setQueryMsgErr] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const [executeMsg, setExecuteMsg] = useState(`${JSON.stringify({ msg: {} }, null, 2)}`);
  const [executeMsgErr, setExecuteMsgErr] = useState('');
  const [executeResult, setExecuteResult] = useState('');

  const execute = async () => {
    const dapp = (window as any).dapp;

    if (!dapp) {
      return;
    }

    dapp
      .request('juno', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['juno'].address);
        log.debug('publicKey', result['juno'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const rpcUrl = 'https://uni-rpc.reece.sh/';

          const client = await StargateClient.connect(rpcUrl);
          log.debug(client);

          const sequence = (await client.getSequence(result['juno'].address)).sequence;
          log.debug('sequence: ' + sequence);

          const accountNumber = (await client.getSequence(result['juno'].address)).accountNumber;
          log.debug('accountNumber: ' + accountNumber);

          const chainId = await client.getChainId();
          log.debug('chainId: ' + chainId);

          log.debug(executeMsg);
          log.debug(contractAddress);

          let executeMsgObj = {} as any;
          try {
            executeMsgObj = JSON.parse(executeMsg);
            const objStr = JSON.stringify(executeMsgObj, null, 2);
            setExecuteMsg(objStr);
            setExecuteMsgErr('');
          } catch (e: any) {
            const error: SyntaxError = e;
            log.error(e);
            setExecuteMsgErr(error?.message);
            return;
          }

          const execContractMsg = {
            typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
            value: {
              sender: result['juno'].address,
              contract: contractAddress,
              msg: toBase64(toUtf8(JSON.stringify(executeMsgObj))) as any,
            },
          };

          const rawTx = {
            account_number: accountNumber,
            chain_id: chainId,
            sequence: sequence,
            fee: { amount: [{ denom: 'ujunox', amount: '50000' }], gas: 200000 },
            msgs: [execContractMsg],
          };

          const res = await (window as any).dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });
          setExecuteResult(`transaction hash : ${res[0]}`);
          log.debug(res);
        } catch (error) {
          log.error(error);
        }
      });
  };

  // query
  const query = async () => {
    const rpcUrl = 'https://uni-rpc.reece.sh/';
    const client = await SigningCosmWasmClient.connect(rpcUrl);

    let queryMsgObj = {} as any;
    try {
      log.debug('queryMsg', queryMsg);
      queryMsgObj = JSON.parse(queryMsg);
      log.debug('queryMsgObj', queryMsgObj);
      const objStr = JSON.stringify(queryMsgObj, null, 2);
      log.debug('objStr', objStr);
      setQueryMsg(objStr);
      setQueryMsgErr('');
    } catch (e: any) {
      const error: SyntaxError = e;
      setQueryMsgErr(error?.message);
      return;
    }
    try {
      const res = await client.queryContractSmart(contractAddress, queryMsgObj);
      log.debug(res);
      setQueryResult(JSON.stringify(res, null, 2));
    } catch (e: any) {
      log.debug('error', e);
      setQueryResult(e?.message);
    }
  };

  // const formatQueryMsg = () => {
  //   try {
  //     const obj = JSON.parse(queryMsg);
  //     const objStr = JSON.stringify(obj, null, 2);
  //     setQueryMsg(objStr);
  //     setQueryMsgErr('');
  //   } catch (e: any) {
  //     const error: SyntaxError = e;
  //     log.error(e);
  //     setQueryMsgErr(error?.message);
  //   }
  // };

  // const formatExecuteMsg = () => {
  //   try {
  //     const obj = JSON.parse(executeMsg);
  //     const objStr = JSON.stringify(obj, null, 2);
  //     setExecuteMsg(objStr);
  //     setExecuteMsgErr('');
  //   } catch (e: any) {
  //     const error: SyntaxError = e;
  //     log.error(e);
  //     setExecuteMsgErr(error?.message);
  //   }
  // };

  const handleQueryChange = (value: any, event: any) => {
    setQueryMsg(value);
  };
  const handleExcuteChange = (value: any, event: any) => {
    setExecuteMsg(value);
  };

  return (
    <ReactForm>
      <ReactForm.Group>
        <div
          style={{ display: 'flex', alignItems: 'center', margin: '0.3em 0.3em' }}
          className="mb-2"
        >
          <div style={{ marginRight: '1em', fontSize: '11px' }}>Query Msg</div>
          {/* <Button onClick={formatQueryMsg} size={'sm'} style={{ marginRight: '1em' }}>
            Format
          </Button> */}
          <Button onClick={query} size={'sm'}>
            Query
          </Button>
        </div>
        {/* <Form.Control
          as="textarea"
          rows={3}
          value={queryMsg}
          onChange={(e) => {
            setQueryMsg(e.target.value);
          }}
          // onKeyDown={handleKeyDown}
          style={{ resize: 'none' }}
        /> */}
        <Editor
          height="60px"
          defaultLanguage="json"
          theme="vs-dark"
          onChange={handleQueryChange}
          options={{
            disableLayerHinting: true,
            disableMonospaceOptimizations: true,
            contextmenu: false,
            minimap: { enabled: false },
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden',
              handleMouseWheel: false,
            },
          }}
        />
        <div>
          <span style={{ color: 'red' }}>{queryMsgErr}</span>
        </div>
        {queryResult && (
          <>
            <Form.Label className="text-muted">Query Result</Form.Label>
            <Form.Control
              as="textarea"
              readOnly
              rows={(queryResult.slice().match(/\n/g) || []).length + 1}
              value={queryResult}
              style={{ resize: 'none', height: '69px' }}
            />
          </>
        )}
        {/* <div style={{ padding: '8px 8px', backgroundColor: '#35384C', color: '#D1D3DC' }}>
          {queryResult}
        </div> */}
      </ReactForm.Group>
      <ReactForm.Group>
        <Form.Group>
          <div
            style={{ display: 'flex', alignItems: 'center', margin: '0.3em 0.3em' }}
            className="mb-2 mt-2"
          >
            <div style={{ marginRight: '1em', fontSize: '11px' }}>Execute Msg</div>
            {/* <Button style={{ marginRight: '1em' }} size={'sm'} onClick={formatExecuteMsg}>
              Format
            </Button> */}
            <Button style={{ marginRight: '1em' }} size={'sm'} onClick={execute}>
              Execute
            </Button>
          </div>
          {/* <Form.Control
            as="textarea"
            rows={3}
            value={executeMsg}
            onChange={(e) => setExecuteMsg(e.target.value)}
            style={{ resize: 'none' }}
          /> */}
          <Editor
            height="60px"
            defaultLanguage="json"
            theme="vs-dark"
            onChange={handleExcuteChange}
            options={{
              disableLayerHinting: true,
              disableMonospaceOptimizations: true,
              contextmenu: false,
              minimap: { enabled: false },
              scrollbar: {
                vertical: 'hidden',
                horizontal: 'hidden',
                handleMouseWheel: false,
              },
            }}
          />
          <span style={{ color: 'red' }}>{executeMsgErr}</span>
          {executeResult && (
            <>
              <Form.Label className="text-muted">Execute Result</Form.Label>
              <Form.Control
                as="textarea"
                readOnly
                // rows={(executeResult.slice().match(/\n/g) || []).length + 1}
                value={executeResult}
                style={{ resize: 'none', height: '86px' }}
                // onChange={handleResizeHeight}
                // innerRef={textareaRef}
              />
            </>
          )}
        </Form.Group>
        <hr />
      </ReactForm.Group>
    </ReactForm>
  );
};
