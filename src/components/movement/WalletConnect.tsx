import React, { useEffect, useState, Dispatch, SetStateAction } from 'react';
import { Alert, Form, InputGroup } from 'react-bootstrap';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { CopyToClipboard } from '../common/CopyToClipboard';
import { Aptos, AptosConfig } from '@aptos-labs/ts-sdk';
import { getNetworkInfo } from './movement-helper';

// 타입 정의와 실제 구현의 불일치 문제를 해결하기 위한 인터페이스
interface NightlyAptosExtended {
  connect: () => Promise<void>;
  getAccount: () => Promise<any>;
  disconnect: () => Promise<void>;
  [key: string]: any;
}

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
  active: boolean;
  account: string;
  setAccount: Dispatch<SetStateAction<string>>;
  setDapp: Dispatch<any>;
  setActive: Dispatch<SetStateAction<boolean>>;
  wallet: string;
  onConnect?: () => Promise<void>;
}

export const WalletConnect: React.FunctionComponent<InterfaceProps> = ({
  client,
  active,
  account,
  setAccount,
  setDapp,
  setActive,
  wallet,
  onConnect,
}) => {
  const [balance, setBalance] = useState<string>('');
  const [error, setError] = useState<String>('');
  const [network, setNetwork] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('Movement Testnet');

  const networks = ['Movement Mainnet', 'Movement Testnet'];

  const fetchBalance = async (address: string) => {
    if (!address) return;

    try {
      const networkInfo = getNetworkInfo(selectedNetwork);
      const config = new AptosConfig({
        fullnode: networkInfo.url || '',
      });
      const aptos = new Aptos(config);

      try {
        const resources = await aptos.getAccountResources({
          accountAddress: address,
        });

        const coinStore = resources.find(
          (r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
        );

        if (coinStore) {
          const balance = (coinStore.data as any).coin.value;
          setBalance(balance);
        } else {
          setBalance('0');
        }
      } catch (e) {
        log.error('리소스 가져오기 실패:', e);
        setBalance('0');
      }
    } catch (e: any) {
      log.error(e);
      setBalance('0');
    }
  };

  useEffect(() => {
    const connect = async () => {
      if (active) {
        try {
          if (!window.nightly?.aptos) {
            setError('Nightly 지갑이 설치되어 있지 않습니다.');
            setActive(false);
            return;
          }

          // 타입 단언으로 실제 구현에 맞는 메서드에 접근
          const nightlyAptos = window.nightly.aptos as unknown as NightlyAptosExtended;

          if (!nightlyAptos) {
            setError('Nightly 지갑 Aptos 객체를 찾을 수 없습니다.');
            setActive(false);
            return;
          }

          try {
            // 연결 요청
            await nightlyAptos.connect();

            // 계정 정보 가져오기
            const accountInfo = await nightlyAptos.getAccount();
            console.log('@@@accountInfo', accountInfo);
            const networkInfo = getNetworkInfo(selectedNetwork);

            if (accountInfo) {
              const accountAddress = accountInfo.address;
              const accountAddressArray = Uint8Array.from(Object.values(accountAddress.data));
              const accountAddressHex = '0x' + Buffer.from(accountAddressArray).toString('hex');
              const pubKey = accountInfo.publicKey.key;
              const pubKeyArray = Uint8Array.from(Object.values(pubKey.data));
              const pubKeyHex = '0x' + Buffer.from(pubKeyArray).toString('hex');
              setAccount(accountAddressHex);
              await fetchBalance(accountAddressHex);

              // 네트워크 설정
              setNetwork(selectedNetwork);

              // DApp을 위한 지갑 인스턴스 설정
              setDapp({
                wallet: nightlyAptos,
                account: {
                  address: accountAddressHex,
                  publicKey: pubKeyHex,
                },
                networks: {
                  movement: {
                    account: {
                      address: accountAddressHex,
                      pubKey: pubKeyHex,
                    },
                    chain: networkInfo.network,
                  },
                },
                disconnect: async () => {
                  try {
                    await nightlyAptos.disconnect();
                    setAccount('');
                    setBalance('');
                    setActive(false);
                  } catch (e) {
                    log.error('연결 해제 실패:', e);
                  }
                },
              });
            } else {
              setError('계정 정보를 가져올 수 없습니다.');
              setActive(false);
            }
          } catch (e: any) {
            log.error('Nightly 지갑 연결 오류:', e);
            if (e.code === 4001) {
              setError('지갑 연결이 거부되었습니다.');
            } else {
              setError(`알 수 없는 오류: ${e.message || '자세한 내용은 콘솔을 확인하세요'}`);
            }
            setActive(false);
          }
        } catch (e: any) {
          log.error('전체 연결 과정 오류:', e);
          if (e.code === 4001) {
            setError('지갑 연결이 거부되었습니다.');
          } else {
            setError(`오류 발생: ${e.message || '자세한 내용은 콘솔을 확인하세요'}`);
          }
          setActive(false);
        }
      }
    };
    connect();
  }, [active, selectedNetwork, setAccount, setActive, setDapp, setNetwork]);

  const handleNetworkChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newNetwork = event.target.value;
    setSelectedNetwork(newNetwork);

    // 이미 지갑이 연결된 상태라면 새 네트워크로 재연결
    if (account) {
      try {
        // 계정이 있으면 잔액 업데이트
        await fetchBalance(account);
      } catch (e: any) {
        log.error(e);
        setError('네트워크 전환 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div style={mt10}>
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
      <Form.Group style={mt8}>
        <Form.Text className="text-muted" style={mb4}>
          <small>NETWORK</small>
        </Form.Text>
        <InputGroup>
          <Form.Control
            className="custom-select"
            as="select"
            value={selectedNetwork}
            onChange={handleNetworkChange}
          >
            {networks.map((networkName, idx) => (
              <option value={networkName} key={idx}>
                {networkName}
              </option>
            ))}
          </Form.Control>
        </InputGroup>
      </Form.Group>
      <Form>
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Account</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Account"
              value={account ? account : ''}
              size="sm"
              readOnly
            />
            <CopyToClipboard tip="Copy" content={account} direction="top-end" />
          </InputGroup>
          <Form.Text className="text-muted" style={mb4}>
            <small>Balance</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Balance"
              value={account ? balance : ''}
              size="sm"
              readOnly
            />
          </InputGroup>
        </Form.Group>
      </Form>
    </div>
  );
};

const mb4 = {
  marginBottom: '4px',
};
const mt8 = {
  marginTop: '8px',
};
const mt10 = {
  marginTop: '10px',
};
