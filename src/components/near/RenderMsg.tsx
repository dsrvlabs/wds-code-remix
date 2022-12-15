import React from 'react'; // eslint-disable-line

const RenderMsg: React.FunctionComponent<{ isLocked: Boolean; status: Boolean }> = ({
  isLocked,
  status,
}) => {
  return (
    <span>
      <div className="remix_ui_terminal_log">
        <i
          className={`remix_ui_terminal_txStatus ${
            status ? 'remix_ui_terminal_succeeded' : 'remix_ui_terminal_failed'
          } fas fa-check-circle`}
          aria-hidden="true"
        ></i>
        <div>
          <span>
            <span className="remix_ui_terminal_tx">[NEAR]</span>
            <div className="remix_ui_terminal_txItem" style={{ fontSize: '20px' }}>
              <span className="remix_ui_terminal_txItemTitle">
                {isLocked ? '(LOCKED)' : '(UNLOCKED)'}
              </span>
              {status ? 'Contract Source Code Verified (Exact Match)' : 'Verification Failed'}
            </div>
          </span>
        </div>
      </div>
    </span>
  );
};

export default RenderMsg;
