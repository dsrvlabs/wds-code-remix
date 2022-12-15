import React from 'react'; // eslint-disable-line

export const RenderTransactions: React.FunctionComponent<{
  status: boolean;
  nonce: Number;
  from: string;
  to: string;
  value: string;
  logs: string;
  hash: string;
  gasUsed: Number;
}> = ({ status, nonce, from, to, value, logs, hash, gasUsed }) => {
  return (
    <span id={`tx${hash}`} key={hash}>
      <div className="remix_ui_terminal_log">
        <i
          className="remix_ui_terminal_txStatus remix_ui_terminal_succeeded fas fa-check-circle"
          aria-hidden="true"
        ></i>
        <div>
          <span>
            <span className="remix_ui_terminal_tx">[klaytn]</span>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">from:</span> {from}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">to:</span> {to}
            </div>
            <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">value:</span> {value} wei
            </div>
            {/* <div className="remix_ui_terminal_txItem">
              <span className="remix_ui_terminal_txItemTitle">receipt:</span> {receipt}
            </div> */}
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
              status
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {status.toString()}
            </td>
          </tr>
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
              from
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableContractAddress${hash}`}
              data-shared={`pair_${hash}`}
            >
              {from}
            </td>
          </tr>
          <tr className="remix_ui_terminal_tr">
            <td className="td tableTitle" data-shared={`key_${hash}`}>
              to
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableFrom${hash}`}
              data-shared={`pair_${hash}`}
            >
              {to}
            </td>
          </tr>
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              gas_used
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableGas${hash}`}
              data-shared={`pair_${hash}`}
            >
              {gasUsed + ' gas'}
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
          <tr className="remix_ui_terminal_tr">
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
              value
            </td>
            <td
              className="remix_ui_terminal_td"
              data-id={`txLoggerTableHash${hash}`}
              data-shared={`pair_${hash}`}
            >
              {value} wei
            </td>
          </tr>
        </tbody>
      </table>
    </span>
  );
};

export const CallResult: React.FunctionComponent<{
  result: Object;
  from: string;
  to: string;
  hash: string;
}> = ({ result, from, to, hash = 'asdf' }) => {
  return (
    <span id={`tx${hash}`} key={hash}>
      <div className="remix_ui_terminal_log">
        <i className="remix_ui_terminal_txStatus remix_ui_terminal_call">call</i>
        <div>
          <span>
            <span className="remix_ui_terminal_tx">[call]</span>
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
            <td className="remix_ui_terminal_td" data-shared={`key_${hash}`}>
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
