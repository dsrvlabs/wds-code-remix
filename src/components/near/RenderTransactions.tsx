import React, { useState } from 'react'; // eslint-disable-line

export const RenderTransactions: React.FunctionComponent<{
  nonce: Number;
  signer: string;
  receiver: string;
  value: string;
  receipt: string;
  logs: string;
  hash: string;
  gasBurnt: Number;
}> = ({ nonce, signer, receiver, value, receipt, logs, hash, gasBurnt }) => {
  return (
    <span id={`tx${hash}`} key={hash}>
      <div className="remix_ui_terminal_log">
        <i
          className="remix_ui_terminal_txStatus remix_ui_terminal_succeeded fas fa-check-circle"
          aria-hidden="true"
        ></i>
        <div>
          <span>
            <span className="remix_ui_terminal_tx">[near]</span>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">signer:</span> {signer}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">receiver:</span> {receiver}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">value:</span> {value} yoctoNEAR
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">receipt:</span> {receipt}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">logs:</span> {logs}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">hash:</span> {hash}
            </div>
          </span>
        </div>
      </div>
      <table
        className={`mt-1 mb-2 mr-4  align-self-center active`}
        id="txTable"
        data-id={`txLoggerTable${hash}`}
      >
        <tbody>
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              transaction hash
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {hash}
            </td>
          </tr>

          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              receiver_id
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableContractAddress${hash}`}
              data-shared={`pair_${hash}`}
            >
              {receiver}
            </td>
          </tr>
          <tr className="remix_ui_terminal_tr">
            <td className="td tableTitle" data-shared={`key_${hash}`}>
              signer
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableFrom${hash}`}
              data-shared={`pair_${hash}`}
            >
              {signer}
            </td>
          </tr>
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              gas_burnt
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableGas${hash}`}
              data-shared={`pair_${hash}`}
            >
              {gasBurnt + ' gas'}
            </td>
          </tr>

          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              nonce
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {nonce + ''}
            </td>
          </tr>

          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              logs
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {logs.toString()}
            </td>
          </tr>
          {value ? (
            <tr className="remix_ui_terminal_tr">
              <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
                val
              </td>
              <td
                className="remix_ui_terminal_td"
                data-id={`txLoggerTableHash${hash}`}
                data-shared={`pair_${hash}`}
              >
                {value} yoctoNEAR
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </span>
  );
};

export const ViewResult: React.FunctionComponent<{
  result: Object;
  from: string;
  to: string;
  hash: string;
}> = ({ result, from, to, hash = 'asdf' }) => {
  return (
    <span id={`tx${hash}`} key={hash}>
      <div className="remix_ui_terminal_log">
        <i className="remix_ui_terminal_txStatus remix_ui_terminal_call">view</i>
        <div>
          <span>
            <span className="remix_ui_terminal_tx">[view]</span>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">from:</span> {from}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">to:</span> {to}
            </div>
          </span>
        </div>
      </div>
      <table
        className={`mt-1 mb-2 mr-4  align-self-center active`}
        id="txTable"
        data-id={`txLoggerTable${hash}`}
      >
        <tbody>
          <tr className="remix_ui_terminal_tr">
            <td
              className="remix_ui_terminal_td"
              data-shared={`key_${hash}`}
              style={{ width: '100px' }}
            >
              output
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {JSON.stringify(result, null, 4)}
            </td>
          </tr>
        </tbody>
      </table>
    </span>
  );
};
