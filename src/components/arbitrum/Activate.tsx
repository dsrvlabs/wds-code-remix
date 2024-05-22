import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Web3 from 'web3';
import axios from 'axios';
import { ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT } from '../../const/endpoint';
import { delay } from '../near/utils/waitForTransaction';

const ACTIVATION_TO_ADDR = '0x0000000000000000000000000000000000000071';

interface InterfaceProps {
  account: string;
  providerInstance: any;
  contractAddr: string;
  client: any;
  dataFee: string;
}

export const Activate: React.FunctionComponent<InterfaceProps> = ({
  account,
  providerInstance,
  contractAddr,
  client,
  dataFee,
}) => {
  const [isActivated, setIsActivated] = useState<boolean>(false);

  const onActivate = async () => {
    if (!providerInstance) {
      return;
    }

    if (!contractAddr) {
      console.log(`No contractAddr`);
    }

    const res = await axios.get(
      ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT +
        `/arbitrum/activation-tx?contractAddr=${contractAddr}`,
    );
    const tx: string = res.data?.tx;
    if (!tx) {
      await client.terminal.log({
        type: 'info',
        value: `Failed to get activation tx for contract ${contractAddr}`,
      });
    }

    const web3 = new Web3(providerInstance);
    const activation_hash = await (window as any).ethereum.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: account,
          to: ACTIVATION_TO_ADDR,
          data: tx,
          value: dataFee,
        },
      ],
    });
    console.log(`@@@ activation_hash`, activation_hash);

    const activation_tx = await web3.eth.getTransaction(activation_hash);
    console.log(`@@@ activation_tx`, activation_tx);
    client.terminal.log({
      type: 'info',
      value: '========================= activation tx ===========================',
    });
    client.terminal.log({ type: 'info', value: JSON.stringify(activation_tx, null, 2) });

    let activation_txReceipt = await web3.eth.getTransactionReceipt(activation_hash);
    console.log(`@@@ activation_txReceipt`, activation_txReceipt);
    if (activation_txReceipt === null) {
      for (let i = 0; i < 3; i++) {
        await delay(2_000);
        activation_txReceipt = await web3.eth.getTransactionReceipt(activation_hash);
        console.log(`@@@ tx_receipt`, activation_txReceipt);
        if (activation_txReceipt) {
          break;
        }
      }
    }

    if (!activation_txReceipt) {
      client.terminal.log({
        type: 'error',
        value: `Failed to get activation tx receipt for hash=${activation_hash}`,
      });
      return;
    }
    if (activation_txReceipt.status) {
      setIsActivated(true);
    }

    client.terminal.log({
      type: 'info',
      value: '====================== activation tx receipt ======================',
    });
    client.terminal.log({ type: 'info', value: JSON.stringify(activation_txReceipt, null, 2) });
  };

  return (
    <>
      <Form>
        <div>
          <Button
            variant="primary"
            onClick={onActivate}
            disabled={isActivated}
            className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          >
            <span>Activate</span>
          </Button>
        </div>
      </Form>
      <hr />
    </>
  );
};
