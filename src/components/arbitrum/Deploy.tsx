import React, { Dispatch } from 'react';
import { Button, Form } from 'react-bootstrap';
// import { Instantiate } from './Instantiate';
// import { simulate, convertToRealChainId } from './arbitrum-helper';
import Web3 from 'web3';
import { delay } from '../near/utils/waitForTransaction';
import { Activate } from './Activate';
import { InterfaceContract } from '../../utils/Types';
import { AbiItem } from 'web3-utils';

interface InterfaceProps {
  providerInstance: any;
  client: any;
  deploymentTx: string;
  setDeploymentTx: Dispatch<React.SetStateAction<string>>;
  checksum: string;
  txHash: string;
  setTxHash: Dispatch<React.SetStateAction<string>>;
  account: string;
  providerNetwork: string;
  isReadyToActivate: boolean;
  dataFee: string;
  contractAddr: string;
  setContractAddr: Dispatch<React.SetStateAction<string>>;
  setContractName: Dispatch<React.SetStateAction<string>>;
  addNewContract: (contract: InterfaceContract) => void; // for SmartContracts
  abi: AbiItem[];
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  providerInstance,
  deploymentTx,
  client,
  account,
  isReadyToActivate,
  dataFee,
  contractAddr,
  setContractAddr,
  setContractName,
  addNewContract,
  abi,
}) => {
  const onDeploy = async () => {
    if (!providerInstance) {
      return;
    }

    if (!deploymentTx) {
      console.log(`No deploymentTx`);
    }

    console.log(`@@@ deploymentTx=${deploymentTx}`);

    const hash = await providerInstance.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: account,
          data: `0x${deploymentTx}`,
        },
      ],
    });
    console.log(`@@@ deployment tx hash`, hash);

    if (!hash) {
      return;
    }

    const web3 = new Web3(providerInstance);
    const tx = await web3.eth.getTransaction(hash);
    console.log(`@@@ tx`, tx);
    client.terminal.log({
      type: 'info',
      value: '========================= deployment tx ===========================',
    });
    client.terminal.log({ type: 'info', value: JSON.stringify(tx, null, 2) });

    let txReceipt = await web3.eth.getTransactionReceipt(hash);
    console.log(`@@@ tx_receipt`, txReceipt);
    if (txReceipt === null) {
      for (let i = 0; i < 3; i++) {
        await delay(2_000);
        txReceipt = await web3.eth.getTransactionReceipt(hash);
        console.log(`@@@ tx_receipt`, txReceipt);
        if (txReceipt) {
          break;
        }
      }
    }

    if (!txReceipt) {
      client.terminal.log({
        type: 'error',
        value: `Failed to get deployment tx receipt for hash=${hash}`,
      });
      return;
    }

    setContractAddr(txReceipt.contractAddress || '');
    if (txReceipt.contractAddress) {
      if (isReadyToActivate) {
        const contract = new web3.eth.Contract(abi, txReceipt.contractAddress);
        try {
          const name = await contract.methods.name().call();
          setContractName(name);
          addNewContract({
            name: name,
            address: txReceipt.contractAddress,
            abi: abi,
          });
          console.log('Contract Name:', name);
        } catch (error) {
          console.error('Error interacting with contract:', error);
        }
      }
    }

    client.terminal.log({
      type: 'info',
      value: '====================== deployment tx receipt ======================',
    });
    client.terminal.log({ type: 'info', value: JSON.stringify(txReceipt, null, 2) });
  };

  return (
    <>
      <Form>
        <Button
          variant="primary"
          onClick={onDeploy}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span>Deploy</span>
        </Button>
        {contractAddr ? (
          <div>
            <small>Contract {contractAddr}</small>
          </div>
        ) : null}

        {contractAddr && isReadyToActivate ? (
          <Activate
            providerInstance={providerInstance}
            contractAddr={contractAddr}
            account={account}
            client={client}
            dataFee={dataFee}
            setContractName={setContractName}
            abi={abi}
            addNewContract={addNewContract}
          ></Activate>
        ) : null}
      </Form>
    </>
  );
};
