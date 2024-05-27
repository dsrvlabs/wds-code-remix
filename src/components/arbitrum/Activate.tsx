import React, { Dispatch, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import Web3 from 'web3';
import axios from 'axios';
import {
  ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT,
  COMPILER_API_ENDPOINT,
} from '../../const/endpoint';
import { delay } from '../near/utils/waitForTransaction';
import { AbiItem } from 'web3-utils';
import { InterfaceContract } from '../../utils/Types';
import { log } from '../../utils/logger';

const ACTIVATION_TO_ADDR = '0x0000000000000000000000000000000000000071';

export interface ArbitrumContractUpdateDto {
  chainId: string;
  address: string;
  activationHash: string;
  activationTimestamp: number;
}
interface InterfaceProps {
  account: string;
  providerInstance: any;
  providerNetwork: string;
  contractAddr: string;
  client: any;
  dataFee: string;
  abi: AbiItem[];
  setContractName: Dispatch<React.SetStateAction<string>>;
  addNewContract: (contract: InterfaceContract) => void; // for SmartContracts
}

export const Activate: React.FunctionComponent<InterfaceProps> = ({
  account,
  providerInstance,
  providerNetwork,
  contractAddr,
  client,
  dataFee,
  abi,
  setContractName,
  addNewContract,
}) => {
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onActivate = async () => {
    setIsLoading(true);
    if (!providerInstance) {
      setIsLoading(false);
      return;
    }

    if (!contractAddr) {
      console.log(`No contractAddr`);
      setIsLoading(false);
      return;
    }

    let tx = '';
    try {
      const res = await axios.get(
        ARBITRUM_COMPILER_CONSUMER_API_ENDPOINT +
          `/arbitrum/activation-tx?contractAddr=${contractAddr}`,
      );
      tx = res.data?.tx;
      if (!tx) {
        await client.terminal.log({
          type: 'info',
          value: `Failed to get activation tx for contract ${contractAddr}`,
        });
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      return;
    }

    const web3 = new Web3(providerInstance);
    let activation_hash = '';
    try {
      activation_hash = await (window as any).ethereum.request({
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
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      return;
    }

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
      const contract = new web3.eth.Contract(abi, contractAddr);
      try {
        const name = await contract.methods.name().call();
        setContractName(name);
        addNewContract({
          name: name,
          address: contractAddr,
          abi: abi,
        });
        console.log('Contract Name:', name);
      } catch (error) {
        console.error('Error interacting with contract:', error);
      }

      let activationTimestamp = 0;
      if (activation_txReceipt.blockNumber) {
        const block = await web3.eth.getBlock(activation_txReceipt.blockNumber);
        if (block) {
          activationTimestamp = Number(block.timestamp) * 1000;
        }
      }

      const arbitrumContractUpdateDto: ArbitrumContractUpdateDto = {
        chainId: providerNetwork,
        address: contractAddr,
        activationHash: activation_hash,
        activationTimestamp: activationTimestamp || 0,
      };
      log.info('arbitrumContractUpdateDto', arbitrumContractUpdateDto);
      try {
        const res = await axios.put(
          COMPILER_API_ENDPOINT + '/arbitrum/contracts',
          arbitrumContractUpdateDto,
        );
        log.info(`put arbitrum/contracts api res`, res);
      } catch (e) {
        log.error(`put arbitrum/contracts api error`);
        console.error(e);
      }
    }

    client.terminal.log({
      type: 'info',
      value: '====================== activation tx receipt ======================',
    });
    client.terminal.log({ type: 'info', value: JSON.stringify(activation_txReceipt, null, 2) });
    setIsLoading(false);
    return;
  };

  return (
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
  );
};
