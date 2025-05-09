import React, { useState, useEffect } from 'react';
import { Button, Alert, Spinner, Modal } from 'react-bootstrap';
import {
  Aptos,
  Network,
  AptosConfig,
  Account,
  Ed25519PrivateKey,
  PublicKey,
  Ed25519PublicKey,
  AnyRawTransaction,
} from '@aptos-labs/ts-sdk';
import { HexString } from 'aptos';
import { MovementGitDependency } from 'wds-event';
import { AptosWallet } from '@aptos-labs/wallet-standard';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import {
  codeBytes,
  getAccountResources,
  getTx,
  metadataSerializedBytes,
  shortHex,
  waitForTransactionWithResult,
  getAccountModules,
} from './movement-helper';

import copy from 'copy-to-clipboard';
import { isNotEmptyList } from '../../utils/ListUtil';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { ModuleWrapper } from './Compiler';
import { Types } from 'aptos';

export interface MovementDeployHistoryCreateDto {
  chainId: string;
  account: string;
  package: string;
  compileTimestamp: number;
  deployTimestamp: number;
  upgradeNumber: string | null;
  upgradePolicy: number | null;
  txHash: string;
  modules: string[];
}

interface InterfaceProps {
  wallet: string;
  accountID: string;
  compileTimestamp: string;
  packageName: string;
  moduleWrappers: ModuleWrapper[];
  metaData64: string;
  moduleBase64s: string[];
  cliVersion: string | null;
  movementGitDependencies: MovementGitDependency[];
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
  setDeployedContract: Function;
  setAtAddress: Function;
  setAccountResources: Function;
  setTargetResource: Function;
  setParameters: Function;
  getAccountModulesFromAccount: Function;
  estimatedGas?: string;
  setEstimatedGas: Function;
  gasUnitPrice: string;
  setGasUnitPrice: Function;
  maxGasAmount: string;
  setMaxGasAmount: Function;
}

interface WriteResourcePackageModule {
  name: string;
}

interface WriteResourcePackage {
  name: string;
  upgrade_number: string;
  upgrade_policy: {
    policy: number;
  };
  modules: WriteResourcePackageModule[];
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  accountID,
  compileTimestamp,
  packageName,
  moduleWrappers,
  metaData64,
  moduleBase64s,
  cliVersion,
  movementGitDependencies,
  wallet,
  dapp,
  setDeployedContract,
  setAtAddress,
  setAccountResources,
  setTargetResource,
  setParameters,
  getAccountModulesFromAccount,
  estimatedGas,
  setEstimatedGas,
  gasUnitPrice,
  setGasUnitPrice,
  maxGasAmount,
  setMaxGasAmount,
}) => {
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('fa-spin');
  const [abi, setABI] = useState<any>({});
  const [param, setParam] = useState<string>('');
  const [resource, setResource] = useState<string>('');
  const [userAccount, setUserAccount] = useState<
    { address: string; publicKey: string } | undefined
  >();
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');
  const [deploymentError, setDeploymentError] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [copyTxMsg, setCopyTxMsg] = useState<string>('복사');

  // 확인 대화상자 관련 상태
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<void>>(() => Promise.resolve());
  const [confirmMessage, setConfirmMessage] = useState<string>('');

  // 사용자 정의 확인 대화상자 호출 함수
  const showConfirm = (message: string, action: () => Promise<void>) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmModal(true);
  };

  // 확인 대화상자 확인 처리
  const handleConfirm = async () => {
    setShowConfirmModal(false);
    await confirmAction();
  };

  // 확인 대화상자 취소 처리
  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  const nightlyProceed = async () => {
    try {
      setInProgress(true);
      setDeployIconSpin('fa-spin');
      setDeploymentStatus('preparing');
      setDeploymentError('');

      // Aptos 클라이언트 설정
      const config = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: 'https://testnet.bardock.movementnetwork.xyz/v1',
      });
      const aptos = new Aptos(config);

      // Nightly 지갑 연결
      const adaptor = window.nightly?.aptos;
      if (!adaptor) {
        throw new Error('지갑 연결 실패');
      }

      // Movement 네트워크 정보
      const networkInfo = {
        chainId: 250,
        name: Network.CUSTOM,
        url: 'https://testnet.bardock.movementnetwork.xyz/v1',
      };

      // 지갑 연결
      await adaptor.features['aptos:connect'].connect(true, networkInfo);
      const accountInfo = await adaptor.features['aptos:account'].account();

      if (!accountInfo) {
        throw new Error('계정 정보를 가져올 수 없습니다.');
      }

      // 트랜잭션 생성 전에 인코딩 시도를 확인할 수 있도록 디버그 로그와 데이터 변환 로직을 추가합니다.
      console.log('트랜잭션 생성 전 데이터 형식 검사:');

      let txnToSimulate;

      try {
        // 메타데이터가 base64 형식이 맞는지 확인
        const isBase64 = (str: string) => {
          try {
            return btoa(atob(str)) === str;
          } catch (err) {
            return false;
          }
        };

        console.log('메타데이터 base64 형식 여부:', isBase64(metaData64));
        console.log('모듈 배열 길이:', moduleBase64s.length);

        // Aptos ts-sdk 방식으로 데이터 변환
        if (metaData64 && typeof metaData64 === 'string') {
          try {
            // Base64 문자열을 Uint8Array로 변환
            const metadataBuffer = Buffer.from(metaData64, 'base64');
            console.log('메타데이터 버퍼 생성 성공, 길이:', metadataBuffer.length);
          } catch (err) {
            console.error('메타데이터 버퍼 변환 오류:', err);
          }
        }

        // 이제 publishPackageTransaction에 맞는 형태로 변환해 보기
        const convertedMetadataBytes = new HexString(
          Buffer.from(metaData64, 'base64').toString('hex'),
        ).toUint8Array();
        console.log('변환된 메타데이터:', convertedMetadataBytes.length > 0 ? '성공' : '실패');

        const convertedModuleBytecodes = moduleBase64s.map((module) =>
          new HexString(Buffer.from(module, 'base64').toString('hex')).toUint8Array(),
        );
        console.log('변환된 모듈 바이트코드 배열 길이:', convertedModuleBytecodes.length);

        // 트랜잭션 생성
        txnToSimulate = await aptos.publishPackageTransaction({
          account: accountInfo.address,
          metadataBytes: convertedMetadataBytes,
          moduleBytecode: convertedModuleBytecodes,
        });

        console.log('트랜잭션 생성 성공:', txnToSimulate);
      } catch (error) {
        console.error('데이터 변환 또는 트랜잭션 생성 중 오류:', error);
        throw new Error(
          `트랜잭션 생성 오류: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      console.log('트랜잭션 요청 파라미터:', {
        account: accountInfo.address,
        metadataBytesType: typeof metaData64,
        moduleBytecodeType: typeof moduleBase64s,
        moduleBytecodeIsArray: Array.isArray(moduleBase64s),
        moduleBytecodeLength: moduleBase64s.length,
      });

      // 트랜잭션 시뮬레이션
      const [simulationResult] = await aptos.transaction.simulate.simple({
        signerPublicKey: accountInfo.publicKey,
        transaction: txnToSimulate,
      });

      console.log('simulationResult', simulationResult);

      if (!simulationResult.success) {
        throw new Error(`시뮬레이션 실패: ${simulationResult.vm_status}`);
      }

      // 가스 예상치 설정
      if (simulationResult.gas_used) {
        setEstimatedGas(simulationResult.gas_used.toString());
      }

      // 지갑으로 트랜잭션 서명 및 제출
      const signAndSubmit = adaptor.features['aptos:signAndSubmitTransaction'];
      if (!signAndSubmit) {
        throw new Error('트랜잭션 서명 기능을 사용할 수 없습니다.');
      }

      const result = await signAndSubmit.signAndSubmitTransaction({
        payload: {
          function: '0x1::aptos_account::transfer_coins',
          typeArguments: ['0x1::aptos_coin::AptosCoin'],
          functionArguments: [
            '0x8a0e6b5972fd11ef6572a54e58e7995b5d8331e8aec8be534f65865b7a4471f7',
            1,
          ],
        },
      });

      // 트랜잭션 응답 타입 체크
      type TransactionResponse = {
        hash: string;
      };

      if (result && typeof result === 'object' && 'hash' in result) {
        const txResponse = result as TransactionResponse;
        const txHash = txResponse.hash;
        setTxHash(txHash);

        // 트랜잭션 완료 대기
        const txResult = (await waitForTransactionWithResult(
          txHash,
          'testnet',
        )) as Types.UserTransaction;
        log.info('트랜잭션 결과:', txResult);

        if ('success' in txResult && txResult.success) {
          await client.terminal.log({
            type: 'info',
            value: {
              hash: txResult.hash,
              success: txResult.success,
              vm_status: txResult.vm_status,
              gas_used: txResult.gas_used,
              sender: txResult.sender,
              sequence_number: txResult.sequence_number,
              timestamp: txResult.timestamp,
            },
          });

          setDeploymentStatus('success');
          setDeployedContract(accountID || '');
          setAtAddress(accountID || '');

          // 계정 리소스 업데이트
          const moveResources = await getAccountResources(accountID || '', 'testnet');
          log.info('계정 리소스:', moveResources);
          setAccountResources([...moveResources]);

          if (isNotEmptyList(moveResources)) {
            setTargetResource(moveResources[0].type);
          } else {
            setTargetResource('');
          }
          setParameters([]);

          log.info('트랜잭션 실행 성공');
        } else {
          const errorMsg = 'vm_status' in txResult ? txResult.vm_status : '알 수 없는 오류';
          log.error(errorMsg);
          await client.terminal.log({
            type: 'error',
            value: errorMsg,
          });
          throw new Error(`트랜잭션 실패: ${errorMsg}`);
        }
      } else {
        throw new Error('트랜잭션 서명이 거부되었거나 실패했습니다.');
      }
    } catch (e) {
      log.error(e);
      setDeploymentStatus('error');
      setDeploymentError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다');
      await client.terminal.log({
        type: 'error',
        value: e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다',
      });
    } finally {
      setInProgress(false);
      setDeployIconSpin('');
    }
  };

  const getStatusMessage = () => {
    switch (deploymentStatus) {
      case 'preparing':
        return '무브 컨트랙트 배포 준비 중...';
      case 'connecting':
        return 'Nightly 지갑에 연결 중... 지갑 확장 프로그램을 확인하세요.';
      case 'signing':
        return '트랜잭션 서명 대기 중... 지갑에서 트랜잭션을 확인하고 승인해주세요.';
      case 'confirming':
        return '트랜잭션 확인 중... (이 과정은 네트워크 상황에 따라 몇 분이 소요될 수 있습니다)';
      case 'success':
        return '컨트랙트 배포 성공! 이제 컨트랙트와 상호작용할 수 있습니다.';
      case 'error':
        return '오류 발생: ' + deploymentError;
      default:
        return '';
    }
  };

  const checkExistContract = async () => {
    if (!accountID) {
      throw new Error('계정 ID가 없습니다');
    }

    if (!(metaData64 && moduleBase64s.length > 0)) {
      throw new Error('메타데이터 또는 모듈이 준비되지 않았습니다');
    }

    await nightlyProceed();
  };

  // 오류 코드 해석 함수 추가
  const getErrorExplanation = (module: string, code: string): string => {
    if (module.includes('0x1::code')) {
      switch (code) {
        case '0x3':
          return '패키지가 이미 존재함 (EPACKAGE_DEP_MISSING)';
        case '0x4':
          return '업그레이드 호환성 오류 (EUPGRADE_IMMUTABLE)';
        case '0x5':
          return '호환되지 않는 메타데이터 버전 (EMODULE_METADATA)';
        default:
          return '알 수 없는 code 모듈 오류';
      }
    } else if (module.includes('0x1::util')) {
      switch (code) {
        case '0x10001':
          return '권한 부족 또는 잘못된 입력값 (PERMISSION_DENIED)';
        default:
          return '알 수 없는 util 모듈 오류';
      }
    }
    return '알 수 없는 오류';
  };

  return (
    <>
      <div className="d-grid gap-2">
        <Button
          variant="warning"
          disabled={inProgress || !metaData64}
          onClick={async () => {
            try {
              await nightlyProceed();
            } catch (e) {
              log.error(e);
              await client.terminal.log({
                type: 'error',
                value: e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다',
              });
              setInProgress(false);
              setDeploymentStatus('error');
              setDeploymentError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다');
            }
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <span>
            {' '}
            {inProgress ? <i className={`fas fa-spinner ${deployIconSpin}`}></i> : ''} Deploy
          </span>
        </Button>

        {deploymentStatus && (
          <Alert
            variant={
              deploymentStatus === 'error'
                ? 'danger'
                : deploymentStatus === 'success'
                ? 'success'
                : 'info'
            }
            className="mt-2"
          >
            <small>{getStatusMessage()}</small>
            {deploymentStatus === 'confirming' && (
              <div className="text-center mt-2">
                <Spinner animation="border" size="sm" />
              </div>
            )}

            {/* 예상 가스 비용 표시 */}
            {estimatedGas && !inProgress && (
              <div className="mt-2">
                <small>
                  예상 가스 사용량: {estimatedGas} 단위 (약 {parseInt(estimatedGas) * 100} Octa)
                </small>
              </div>
            )}

            {/* 트랜잭션 해시 표시 및 복사 기능 */}
            {txHash && (deploymentStatus === 'confirming' || deploymentStatus === 'success') && (
              <div className="mt-2">
                <small>
                  트랜잭션 해시:{' '}
                  {typeof txHash === 'string'
                    ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}`
                    : txHash}
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-0 pt-0"
                    onClick={() => {
                      copy(txHash);
                      setCopyTxMsg('복사됨!');
                    }}
                    onMouseLeave={() => {
                      setTimeout(() => setCopyTxMsg('복사'), 100);
                    }}
                  >
                    <i className="far fa-copy" /> <small>{copyTxMsg}</small>
                  </Button>
                </small>
              </div>
            )}
          </Alert>
        )}

        {Object.keys(abi).length ? (
          <div style={{ textAlign: 'right', marginBottom: '3px' }}>
            {'ABI   '}
            <i
              className="far fa-copy"
              onClick={() => {
                copy(JSON.stringify(abi, null, 4));
              }}
            />
          </div>
        ) : (
          false
        )}
      </div>
      <hr />

      {/* 사용자 정의 확인 대화상자 */}
      <Modal
        show={showConfirmModal}
        onHide={handleCancel}
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>확인</Modal.Title>
        </Modal.Header>
        <Modal.Body>{confirmMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCancel}>
            취소
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            확인
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
