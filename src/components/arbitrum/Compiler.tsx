import React, { Dispatch, useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';

import {
  compileIdV2,
  COMPILER_ARBITRUM_COMPILE_COMPLETED_V1,
  COMPILER_ARBITRUM_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_ARBITRUM_COMPILE_LOGGED_V1,
  CompilerArbitrumCompileCompletedV1,
  CompilerArbitrumCompileErrorOccurredV1,
  CompilerArbitrumCompileLoggedV1,
  REMIX_ARBITRUM_COMPILE_REQUESTED_V1,
  RemixArbitrumCompileRequestedV1,
} from 'wds-event';
import { ARBITRUM_COMPILER_CONSUMER_ENDPOINT, COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { getPositionDetails, isRealError, stringify } from '../../utils/helper';
import { log } from '../../utils/logger';
import { EditorClient } from '../../utils/editor';
import AlertCloseButton from '../common/AlertCloseButton';
import { DisconnectDescription, Socket } from 'socket.io-client/build/esm/socket';
import { cleanupSocketArbitrum } from '../../socket';
import { io } from 'socket.io-client';
import { CHAIN_NAME } from '../../const/chain';
import { S3Path } from '../../const/s3-path';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import { isEmptyList } from '../../utils/ListUtil';
import { CustomTooltip } from '../common/CustomTooltip';
import { Deploy } from './Deploy';
import stripAnsi from 'strip-ansi';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import { InterfaceContract } from '../../utils/Types';
import { AbiItem } from 'web3-utils';

interface InterfaceProps {
  fileName: string;
  setFileName: Dispatch<React.SetStateAction<string>>;
  compileTarget: string;
  account: string;
  providerInstance: any;
  client: any;
  providerNetwork: string;
  contractAbiMap: Map<string, AbiItem[]>;
  setContractAbiMap: Dispatch<React.SetStateAction<Map<string, AbiItem[]>>>;
  contractAddr: string;
  setContractAddr: Dispatch<React.SetStateAction<string>>;
  setContractName: Dispatch<React.SetStateAction<string>>;
  addNewContract: (contract: InterfaceContract) => void; // for SmartContracts
  setSelected: (select: InterfaceContract) => void; // for At Address
  isCompiling: boolean;
  setIsCompiling: Dispatch<React.SetStateAction<boolean>>;
  isActivated: boolean;
  setIsActivated: Dispatch<React.SetStateAction<boolean>>;
}

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  fileName,
  setFileName,
  client,
  providerInstance,
  compileTarget,
  account,
  providerNetwork,
  contractAbiMap,
  setContractAbiMap,
  setContractAddr,
  setContractName,
  addNewContract,
  setSelected,
  isCompiling,
  setIsCompiling,
  isActivated,
  setIsActivated,
}) => {
  const [deploymentTx, setDeploymentTx] = useState<string>('');
  const [isReadyToActivate, setIsReadToActivate] = useState<boolean>(false);
  const [dataFee, setDataFee] = useState<string>('');
  const [compileError, setCompileError] = useState<Nullable<string>>('');
  const [txHash, setTxHash] = useState<string>('');
  const [timestamp, setTimestamp] = useState('');

  const [uploadCodeChecked, setUploadCodeChecked] = useState(true);

  useEffect(() => {
    init();
  }, [compileTarget]);

  const removeArtifacts = async () => {
    log.info(`removeArtifacts ${'browser/' + compileTarget + '/output'}`);
    try {
      await client?.fileManager.remove('browser/' + compileTarget + '/output');
    } catch (e) {
      log.info(`no out folder`);
    }
  };

  const init = () => {
    setDeploymentTx('');
    setIsReadToActivate(false);
    setIsActivated(false);
    setDataFee('');
    setFileName('');
    setTxHash('');
    setTimestamp('');
  };

  const handleCheckboxChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setUploadCodeChecked(event.target.checked);
  };

  const readCode = async () => {
    if (isCompiling) {
      client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    await removeArtifacts();

    init();
    // setAbi([]); // todo

    let projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    log.info(
      `@@@ compile compileTarget=${compileTarget}, projFiles=${JSON.stringify(projFiles, null, 2)}`,
    );
    if (isEmptyList(projFiles)) {
      return;
    }

    const rustToolchainFile = projFiles.find(
      (f) => f.path === `${compileTarget}/rust-toolchain.toml`,
    );
    if (!rustToolchainFile) {
      client.terminal.log({
        type: 'warn',
        value: `Not found "rust-toolchain.toml". Added default "rust-toolchain.toml".`,
      });
      const rustToolchainContent = `[toolchain]\nchannel = "1.80.0"`;
      await client.fileManager.writeFile(
        `browser/${compileTarget}/rust-toolchain.toml`,
        rustToolchainContent,
      );
      projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    }

    const blob = await generateZip(projFiles);
    if (!blob) {
      return;
    }

    await compile(blob, projFiles);
  };

  const generateZip = async (fileInfos: Array<FileInfo>) => {
    const zip = new JSZip();

    await Promise.all(
      fileInfos.map(async (fileinfo: FileInfo) => {
        if (fileinfo.path.startsWith(`${compileTarget}/artifacts`)) {
          return;
        }

        if (fileinfo.path.startsWith(`${compileTarget}/schema`)) {
          return;
        }

        if (!fileinfo.isDirectory) {
          const content = await client?.fileManager.readFile(fileinfo.path);
          const f = createFile(
            content || '',
            fileinfo.path.substring(fileinfo.path.lastIndexOf('/') + 1),
          );
          const chainFolderExcluded = fileinfo.path.substring(fileinfo.path.indexOf('/') + 1);
          // console.log(`chainFolderExcluded=${chainFolderExcluded}`);
          const projFolderExcluded = chainFolderExcluded.substring(
            chainFolderExcluded.indexOf('/') + 1,
          );
          // console.log(`projFolderExcluded=${projFolderExcluded}`);
          zip.file(projFolderExcluded, f);
        }
      }),
    );
    return await zip.generateAsync({ type: 'blob' });
  };

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const compile = async (blob: Blob, projFiles: FileInfo[]) => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    setIsCompiling(true);
    setCompileError('');

    const timestamp = Date.now().toString();
    setTimestamp(timestamp);
    // const socketArbitrum = io(ARBITRUM_COMPILER_CONSUMER_ENDPOINT, {
    //   timeout: 40_000,
    //   ackTimeout: 300_000,
    //   reconnection: false,
    //   transports: ['websocket'],
    // });

    // ------------------------------------------------------------------
    try {
      const isSrcZipUploadSuccess = await FileUtil.uploadSrcZip({
        chainName: CHAIN_NAME.arbitrum,
        chainId: providerNetwork,
        account: account || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'arbitrum',
        zipFile: blob,
      });
      if (!isSrcZipUploadSuccess) {
        log.error(`src zip upload fail. address=${account}, timestamp=${timestamp}`);
        setIsCompiling(false);
        return;
      }
    } catch (e) {
      log.error(`src zip upload fail. address=${account}, timestamp=${timestamp}`);
      setIsCompiling(false);
      client.terminal.log({ type: 'error', value: `compile error.` });
      return;
    }

    const projFiles_ = projFiles
      .filter((fileinfo) => {
        if (fileinfo.path === `${compileTarget}/output` && fileinfo.isDirectory) {
          return false;
        }

        if (fileinfo.path.startsWith(`${compileTarget}/output/`)) {
          return false;
        }

        return true;
      })
      .map((pf) => ({
        path: pf.path.replace(compileTarget + '/', ''),
        isDirectory: pf.isDirectory,
      }));
    const uploadUrls = await FileUtil.uploadUrls({
      chainName: CHAIN_NAME.arbitrum,
      chainId: providerNetwork,
      account: account || 'noaddress',
      timestamp: timestamp.toString() || '0',
      projFiles: projFiles_,
    });

    if (uploadUrls.length === 0) {
      log.error(`uploadUrls fail`);
      setIsCompiling(false);
      return;
    }

    const contents = await FileUtil.contents(client.fileManager, compileTarget, projFiles_);
    console.log(`@@@ contents`, contents);
    const uploadResults = await Promise.all(
      uploadUrls.map((u, i) => axios.put(u.url, contents[i])),
    );
    console.log(`@@@ uploadResults`, uploadResults);

    // ------------------------------------------------------------------

    const socket = io(ARBITRUM_COMPILER_CONSUMER_ENDPOINT, {
      reconnection: false,
      transports: ['websocket'],
      timeout: 120_000,
    });

    try {
      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setIsCompiling(false);
        socket.disconnect();
      });

      socket.on('connect', async () => {});

      socket.on(
        'disconnect',
        (reason: Socket.DisconnectReason, description?: DisconnectDescription) => {
          log.info('[SOCKET.ARBITRUM] disconnected.', reason, description);
          setIsCompiling(false);
          log.info(`@@@ after disconnect. disconnected=${socket.disconnected}`);
          cleanupSocketArbitrum(socket);
        },
      );

      socket.on('connect_error', async function (err) {
        // handle server error here
        log.info('[SOCKET.ARBITRUM] Error connecting to server');
        log.error(err);
        setIsCompiling(false);
        log.info(`@@@ after connect_error. disconnected=${socket.disconnected}`);
        cleanupSocketArbitrum(socket);
        client.terminal.log({
          type: 'error',
          value: `${err.message}`,
        });
      });

      socket.on(
        COMPILER_ARBITRUM_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerArbitrumCompileErrorOccurredV1) => {
          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.arbitrum,
                  chainId: providerNetwork,
                  account: account,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              console.log(`Failed to delete.`);
            }
          }

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_ARBITRUM_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.arbitrum, providerNetwork, account, timestamp)
          ) {
            return;
          }
          client.terminal.log({ type: 'error', value: data.errMsg.toString() });

          setIsCompiling(false);
          socket.disconnect();
          cleanupSocketArbitrum(socket);
        },
      );

      socket.on(
        COMPILER_ARBITRUM_COMPILE_LOGGED_V1,
        async (data: CompilerArbitrumCompileLoggedV1) => {
          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_ARBITRUM_COMPILE_LOGGED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.arbitrum, providerNetwork, account, timestamp)
          ) {
            return;
          }

          client.terminal.log({ type: 'info', value: stripAnsi(data.logMsg) });

          if (data.logMsg.includes('error')) {
            const { file, annotation, highlightPosition, positionDetail } = getPositionDetails(
              data.logMsg,
            );

            if (file) {
              if (isRealError(annotation)) {
                // await editorClient.switchFile(`${compileTarget}/${file}`);
                await editorClient.addAnnotation(annotation);
                await editorClient.gotoLine(positionDetail.row, positionDetail.col);
                // await editorClient.highlight(
                //   highlightPosition,
                //   `${compileTarget}/${file}`,
                //   '#ff7675',
                // );

                setCompileError((prev) => `${prev}\n${data.logMsg}`);
                setIsCompiling(false);
                socket.disconnect();
                return;
              }
            }
          }

          if (data.logMsg.includes('wasm data fee:')) {
            setIsReadToActivate(true);
            const msg = stripAnsi(data.logMsg);
            console.log(`msg=${msg}`);
            const idx = msg.indexOf('Ξ');
            const lineFeedIdx = msg.indexOf('\n');
            const dataFee = msg.slice(idx + 1, lineFeedIdx);
            const web3 = new Web3();
            const wei = web3.utils.toWei(dataFee, 'ether');
            const finalWei = new BigNumber(wei).multipliedBy(120).div(100).toString();
            const hex = web3.utils.toHex(finalWei.toString());
            console.log(
              `dataFee=${dataFee}, len=${dataFee.length}, wei=${wei}, finalWei=${finalWei}, finalWeiHex=${hex}`,
            );
            setDataFee(hex);
          }
        },
      );

      socket.on(
        COMPILER_ARBITRUM_COMPILE_COMPLETED_V1,
        async (data: CompilerArbitrumCompileCompletedV1) => {
          socket.disconnect();

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_ARBITRUM_COMPILE_COMPLETED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.arbitrum, providerNetwork, account, timestamp)
          ) {
            return;
          }

          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              bucket: S3Path.bucket(),
              fileKey: S3Path.outKey(
                CHAIN_NAME.arbitrum,
                providerNetwork,
                account,
                timestamp,
                BUILD_FILE_TYPE.rs,
              ),
            },
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

          if (!uploadCodeChecked) {
            console.log(`Delete source files.`);
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.arbitrum,
                  chainId: providerNetwork,
                  account: account,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              console.log(`Failed to delete.`);
            }
          }

          const zip = await new JSZip().loadAsync(res.data);

          try {
            await Promise.all(
              Object.keys(zip.files).map(async (filename) => {
                log.info(`arbitrum build result filename=${filename}`);
                if (filename.endsWith('output/deployment_tx_data')) {
                  const fileData = await zip.files[filename].async('blob');
                  const hex = Buffer.from(await fileData.arrayBuffer()).toString('hex');
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/' + filename,
                    hex,
                  );
                  setDeploymentTx(hex);
                  setFileName(filename);
                } else if (filename.endsWith('output/activation_tx_data')) {
                  const fileData = await zip.files[filename].async('blob');
                  const hex = Buffer.from(await fileData.arrayBuffer()).toString('hex');
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/' + filename,
                    hex,
                  );
                } else {
                  const fileData = await zip.files[filename].async('string');
                  if (filename === 'output/abi.json') {
                    const abi = JSON.parse(fileData) as AbiItem[];
                    console.log(`@@@ saved output/abi.json abi=${JSON.stringify(abi)}`, abi);
                    // setAbi(abi);
                    // setSelected({
                    //   name: '',
                    //   address: '',
                    //   abi: abi.filter((a) => a.type === 'function'),
                    // });
                    client.terminal.log({
                      type: 'info',
                      value: `======================== ABI ========================`,
                    });
                    client.terminal.log({
                      type: 'info',
                      value: `${JSON.stringify(abi, null, 2)}`,
                    });
                  }

                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/' + filename,
                    fileData,
                  );
                }
              }),
            );

            const projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
            log.info(
              `@@@ compile compileTarget=${compileTarget}, projFiles=${JSON.stringify(
                projFiles,
                null,
                2,
              )}`,
            );
            client.terminal.log({
              type: 'info',
              value: `\nBuild Completed.`,
            });
          } catch (e) {
            log.error(e);
          } finally {
            setIsCompiling(false);
          }
        },
      );

      const remixArbitrumCompileRequestedV1: RemixArbitrumCompileRequestedV1 = {
        compileId: compileIdV2(CHAIN_NAME.arbitrum, providerNetwork, account, timestamp),
        chainName: CHAIN_NAME.arbitrum,
        chainId: providerNetwork,
        address: account || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'arbitrum',
      };

      socket.emit(REMIX_ARBITRUM_COMPILE_REQUESTED_V1, remixArbitrumCompileRequestedV1);
      log.info(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_ARBITRUM_COMPILE_REQUESTED_V1} data=${stringify(
          remixArbitrumCompileRequestedV1,
        )}`,
      );
    } catch (e) {
      log.error(e);
      setIsCompiling(false);
    }
  };

  const handleAlertClose = () => {
    setCompileError('');
    client.call('editor', 'discardHighlight');
    client.call('editor', 'clearAnnotations');
  };

  return (
    <>
      <div className="mb-2 form-check">
        <input
          type="checkbox"
          className="form-check-input"
          id="uploadCodeCheckbox"
          checked={uploadCodeChecked}
          onChange={handleCheckboxChange}
          disabled={isCompiling || !!fileName}
        />
        <CustomTooltip
          placement="top"
          tooltipId="overlay-ataddresss"
          tooltipText="When you upload the code, a code verification feature will be provided in the future."
        >
          <label
            className="form-check-label"
            htmlFor="uploadCodeCheckbox"
            style={{ verticalAlign: 'top' }}
          >
            Upload Code
          </label>
        </CustomTooltip>
      </div>
      <Button
        variant="primary"
        disabled={account === '' || isCompiling || !compileTarget}
        onClick={readCode}
        className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
      >
        <FaSyncAlt className={isCompiling ? 'fa-spin' : undefined} />
        <span>Compile</span>
      </Button>
      {compileError !== '' && (
        <Alert
          variant="danger"
          className="mt-3"
          style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
        >
          <AlertCloseButton onClick={handleAlertClose} />
          {compileError}
        </Alert>
      )}
      {fileName ? (
        <div>
          <small>{fileName}</small>
        </div>
      ) : null}
      {deploymentTx && !isCompiling ? (
        <Deploy
          compileTarget={compileTarget}
          providerInstance={providerInstance}
          timestamp={timestamp}
          client={client}
          deploymentTx={deploymentTx}
          setDeploymentTx={setDeploymentTx}
          txHash={txHash}
          setTxHash={setTxHash}
          account={account}
          providerNetwork={providerNetwork}
          isReadyToActivate={isReadyToActivate}
          dataFee={dataFee}
          setContractAddr={setContractAddr}
          setContractName={setContractName}
          addNewContract={addNewContract}
          contractAbiMap={contractAbiMap}
          setContractAbiMap={setContractAbiMap}
          setSelected={setSelected}
          uploadCodeChecked={uploadCodeChecked}
          isActivated={isActivated}
          setIsActivated={setIsActivated}
        />
      ) : null}
    </>
  );
};
