import React, { Dispatch, useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { StoreCode } from './StoreCode';

import {
  compileIdV2,
  COMPILER_NEUTRON_COMPILE_COMPLETED_V1,
  COMPILER_NEUTRON_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_NEUTRON_COMPILE_LOGGED_V1,
  CompilerNeutronCompileCompletedV1,
  CompilerNeutronCompileErrorOccurredV1,
  CompilerNeutronCompileLoggedV1,
  REMIX_NEUTRON_COMPILE_REQUESTED_V1,
  RemixNeutronCompileRequestedV1,
} from 'wds-event';
import { COMPILER_API_ENDPOINT, NEUTRON_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import { getPositionDetails, isRealError, readFile, stringify } from '../../utils/helper';
import { log } from '../../utils/logger';
import { EditorClient } from '../../utils/editor';
import AlertCloseButton from '../common/AlertCloseButton';
import { DisconnectDescription, Socket } from 'socket.io-client/build/esm/socket';
import { cleanupSocketNeutron } from '../../socket';
import { io } from 'socket.io-client';
import { CHAIN_NAME } from '../../const/chain';
import { S3Path } from '../../const/s3-path';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';
import { convertToRealChainId } from './neutron-helper';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { UploadUrlDto } from '../../types/dto/upload-url.dto';
import { CustomTooltip } from '../common/CustomTooltip';

interface InterfaceProps {
  fileName: string;
  setFileName: Dispatch<React.SetStateAction<string>>;
  compileTarget: string;
  wallet: string;
  account: string;
  providerInstance: any;
  client: any;
  reset: () => void;
  providerNetwork: string;
}

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  fileName,
  setFileName,
  client,
  providerInstance,
  compileTarget,
  wallet,
  account,
  reset,
  providerNetwork,
}) => {
  const [iconSpin, setIconSpin] = useState<string>('');
  const [wasm, setWasm] = useState<string>('');
  const [checksum, setChecksum] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>('');
  const [txHash, setTxHash] = useState<string>('');
  const [codeID, setCodeID] = useState<string>('');
  const [timestamp, setTimestamp] = useState('');

  const [schemaInit, setSchemaInit] = useState<{ [key: string]: any }>({});
  const [schemaExec, setSchemaExec] = useState<Object>({});
  const [schemaQuery, setSchemaQuery] = useState<Object>({});

  const [uploadCodeChecked, setUploadCodeChecked] = useState(true);

  useEffect(() => {
    init();
  }, [compileTarget]);

  const exists = async () => {
    try {
      const artifacts = await client?.fileManager.readdir(
        'browser/' + compileTarget + '/artifacts',
      );
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'artifacts' and 'schema' directory and click the Compile button again.",
      });
      const filesName = Object.keys(artifacts || {});
      await Promise.all(
        filesName.map(async (f) => {
          if (getExtensionOfFilename(f) === '.wasm') {
            const wasmFile = await client?.fileManager.readFile('browser/' + f);
            setWasm(wasmFile || '');
            setFileName(f);
          }
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const removeArtifacts = async () => {
    log.info(`removeArtifacts ${'browser/' + compileTarget + '/out'}`);
    try {
      await client?.fileManager.remove('browser/' + compileTarget + '/out');
    } catch (e) {
      log.info(`no out folder`);
    }
  };

  const init = () => {
    setWasm('');
    setChecksum('');
    setFileName('');
    setCodeID('');
    setTxHash('');
    setSchemaExec({});
    setSchemaInit({});
    setSchemaQuery({});
    setTimestamp('');
  };

  const handleCheckboxChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setUploadCodeChecked(event.target.checked);
  };

  const readCode = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    await removeArtifacts();
    init();

    const projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    log.info(
      `@@@ compile compileTarget=${compileTarget}, projFiles=${JSON.stringify(projFiles, null, 2)}`,
    );
    if (isEmptyList(projFiles)) {
      return;
    }

    // const existsOutFolder = projFiles.find((f) => f.path.startsWith(`${compileTarget}/artifacts`));
    // if (existsOutFolder) {
    //   await client.terminal.log({
    //     type: 'error',
    //     value:
    //       "If you want to run a new compilation, delete the 'artifacts' directory and click the Compile button again.",
    //   });
    //   return;
    // }

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

        if (fileinfo.path.startsWith(`${compileTarget}/Cargo.lock`)) {
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
    setLoading(true);
    setIconSpin('fa-spin');
    setCompileError('');

    const address = account;
    const timestamp = Date.now().toString();
    setTimestamp(timestamp);
    // const socketNeutron = io(NEUTRON_COMPILER_CONSUMER_ENDPOINT, {
    //   timeout: 40_000,
    //   ackTimeout: 300_000,
    //   reconnection: false,
    //   transports: ['websocket'],
    // });

    // ------------------------------------------------------------------

    let realChainId = providerNetwork;

    if (wallet === 'Welldone') {
      realChainId = convertToRealChainId(providerInstance.networks.neutron.chain);
    }

    const isSrcZipUploadSuccess = await FileUtil.uploadSrcZip({
      chainName: CHAIN_NAME.neutron,
      chainId: realChainId,
      account: address || 'noaddress',
      timestamp: timestamp.toString() || '0',
      fileType: 'neutron',
      zipFile: blob,
    });
    if (!isSrcZipUploadSuccess) {
      log.error(`src zip upload fail. address=${address}, timestamp=${timestamp}`);
      setIconSpin('');
      setLoading(false);
      return;
    }

    const projFiles_ = projFiles
      .filter((fileinfo) => {
        if (fileinfo.path === `${compileTarget}/artifacts` && fileinfo.isDirectory) {
          return false;
        }

        if (fileinfo.path.startsWith(`${compileTarget}/artifacts/`)) {
          return false;
        }

        if (fileinfo.path === `${compileTarget}/schema` && fileinfo.isDirectory) {
          return false;
        }

        if (fileinfo.path.startsWith(`${compileTarget}/schema/`)) {
          return false;
        }

        if (fileinfo.path.startsWith(`${compileTarget}/Cargo.lock`)) {
          return false;
        }
        return true;
      })
      .map((pf) => ({
        path: pf.path.replace(compileTarget + '/', ''),
        isDirectory: pf.isDirectory,
      }));

    const uploadUrls = await FileUtil.uploadUrls({
      chainName: CHAIN_NAME.neutron,
      chainId: realChainId,
      account: address || 'noaddress',
      timestamp: timestamp.toString() || '0',
      projFiles: projFiles_,
    });

    if (uploadUrls.length === 0) {
      log.error(`uploadUrls fail`);
      setIconSpin('');
      setLoading(false);
      return;
    }

    const contents = await FileUtil.contents(client.fileManager, compileTarget, projFiles_);
    console.log(`@@@ contents`, contents);
    const uploadResults = await Promise.all(
      uploadUrls.map((u, i) => axios.put(u.url, contents[i])),
    );
    console.log(`@@@ uploadResults`, uploadResults);

    // ------------------------------------------------------------------

    const socket = io(NEUTRON_COMPILER_CONSUMER_ENDPOINT, {
      reconnection: false,
      transports: ['websocket'],
    });

    try {
      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setLoading(false);
        socket.disconnect();
      });

      socket.on('connect', async () => {});

      socket.on(
        'disconnect',
        (reason: Socket.DisconnectReason, description?: DisconnectDescription) => {
          log.info('[SOCKET.NEUTRON] disconnected.', reason, description);
          setIconSpin('');
          setLoading(false);
          log.info(`@@@ after disconnect. disconnected=${socket.disconnected}`);
          cleanupSocketNeutron(socket);
        },
      );

      socket.on('connect_error', function (err) {
        // handle server error here
        log.info('[SOCKET.NEUTRON] Error connecting to server');
        log.error(err);
        setIconSpin('');
        setLoading(false);
        log.info(`@@@ after connect_error. disconnected=${socket.disconnected}`);
        cleanupSocketNeutron(socket);
        client.terminal.log({
          type: 'error',
          value: `${err.message}`,
        });
      });

      socket.on(
        COMPILER_NEUTRON_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerNeutronCompileErrorOccurredV1) => {
          await axios.request({
            method: 'DELETE',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              chainName: CHAIN_NAME.neutron,
              chainId: realChainId,
              account: account,
              timestamp: timestamp,
            },
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEUTRON_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileIdV2(CHAIN_NAME.neutron, realChainId, address, timestamp)) {
            return;
          }
          await client.terminal.log({ type: 'error', value: data.errMsg.toString() });
          setIconSpin('');
          setLoading(false);
          socket.disconnect();
          cleanupSocketNeutron(socket);
        },
      );

      socket.on(
        COMPILER_NEUTRON_COMPILE_LOGGED_V1,
        async (data: CompilerNeutronCompileLoggedV1) => {
          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEUTRON_COMPILE_LOGGED_V1} data=${stringify(data)}`,
          );
          if (data.compileId !== compileIdV2(CHAIN_NAME.neutron, realChainId, address, timestamp)) {
            return;
          }

          // client?.terminal.log({ value: data.logMsg, type: 'info' }); // todo remix v0.28.0
          await client.terminal.log({ type: 'info', value: data.logMsg });

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

                setIconSpin('');
                setLoading(false);
                socket.disconnect();
                return;
              }
            }
          }
        },
      );

      socket.on(
        COMPILER_NEUTRON_COMPILE_COMPLETED_V1,
        async (data: CompilerNeutronCompileCompletedV1) => {
          socket.disconnect();

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEUTRON_COMPILE_COMPLETED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileIdV2(CHAIN_NAME.neutron, realChainId, address, timestamp)) {
            return;
          }

          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              bucket: S3Path.bucket(),
              fileKey: S3Path.outKey(
                CHAIN_NAME.neutron,
                realChainId,
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
            await axios.request({
              method: 'DELETE',
              url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
              params: {
                chainName: CHAIN_NAME.neutron,
                chainId: realChainId,
                account: account,
                timestamp: timestamp,
              },
              responseType: 'arraybuffer',
              responseEncoding: 'null',
            });
          }

          const zip = await new JSZip().loadAsync(res.data);

          try {
            await Promise.all(
              Object.keys(zip.files).map(async (filename) => {
                log.info(`neutron build result filename=${filename}`);
                if (getExtensionOfFilename(filename) === '.wasm') {
                  const fileData = await zip.files[filename].async('blob');

                  const wasmFile = await readFile(new File([fileData], filename));
                  log.info(wasmFile);

                  // wasm 파일 base64 형태로 저장했다가 쉽게 재사용
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/' + filename,
                    wasmFile,
                  );
                  setWasm(wasmFile);
                  setFileName(filename);

                  // schema obj
                  await setSchemaObj();
                } else if (getExtensionOfFilename(filename) === '.json') {
                  const fileData = await zip.files[filename].async('string');
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/' + filename,
                    fileData,
                  );
                } else {
                  const fileData = await zip.files[filename].async('string');
                  if (filename === 'artifacts/checksums.txt') {
                    const checksum = fileData.slice(0, 64);
                    console.log(`@@@ checksum=${checksum}`);
                    setChecksum(checksum);
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

            const schemaFiles = projFiles
              .filter(
                (fileinfo) =>
                  fileinfo.path.startsWith(`${compileTarget}/schema`) &&
                  !(fileinfo.path === `${compileTarget}/schema` && fileinfo.isDirectory),
              )
              .map((pf) => ({
                path: pf.path.replace(compileTarget + '/schema/', ''),
                isDirectory: pf.isDirectory,
              }));

            log.info(
              `@@@ compile compileTarget=${compileTarget}, schemaFiles=${JSON.stringify(
                schemaFiles,
                null,
                2,
              )}`,
            );

            if (isNotEmptyList(schemaFiles)) {
              const uploadUrlsRes = await axios.post(
                COMPILER_API_ENDPOINT + '/s3Proxy/schema-upload-urls',
                {
                  chainName: CHAIN_NAME.neutron,
                  chainId: realChainId,
                  account: address || 'noaddress',
                  timestamp: timestamp.toString() || '0',
                  paths: schemaFiles.map((f) => ({
                    path: f.path,
                    isDirectory: f.isDirectory,
                  })),
                },
              );

              if (uploadUrlsRes.status === 201) {
                console.log(`@@@ schemaFiles Upload files`);
                const uploadUrls = uploadUrlsRes.data as UploadUrlDto[];

                const contents = await Promise.all(
                  schemaFiles.map(async (u) => {
                    if (u.isDirectory) {
                      return '';
                    }
                    return await client.fileManager.readFile(
                      'browser/' + compileTarget + '/schema/' + u.path,
                    );
                  }),
                );
                console.log(`@@@ schemaFiles contents`, contents);
                const promises = uploadUrls.map((u, i) => axios.put(u.url, contents[i]));
                const uploadResults = await Promise.all(promises);
                console.log(`@@@ schemaFiles uploadResults`, uploadResults);
              }
            }
          } catch (e) {
            log.error(e);
          } finally {
            setIconSpin('');
            setLoading(false);
          }
        },
      );

      const remixNeutronCompileRequestedV1: RemixNeutronCompileRequestedV1 = {
        compileId: compileIdV2(CHAIN_NAME.neutron, realChainId, address, timestamp),
        chainName: CHAIN_NAME.neutron,
        chainId: realChainId,
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'neutron',
      };

      socket.emit(REMIX_NEUTRON_COMPILE_REQUESTED_V1, remixNeutronCompileRequestedV1);
      log.info(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_NEUTRON_COMPILE_REQUESTED_V1} data=${stringify(
          remixNeutronCompileRequestedV1,
        )}`,
      );
    } catch (e) {
      log.error(e);
      setIconSpin('');
      setLoading(false);
    }
  };

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    return filename.substring(_lastDot, _fileLen).toLowerCase();
  };

  const setSchemaObj = async () => {
    try {
      log.info(compileTarget);
      const schemaPath = await client?.fileManager.readdir('browser/' + compileTarget + '/schema');
      log.info(schemaPath);

      const schemaFiles = Object.keys(schemaPath || ['']);
      const arr: Object[] = [];

      await Promise.all(
        schemaFiles.map(async (filename: string) => {
          if (getExtensionOfFilename(filename) === '.json') {
            arr.push(JSON.parse((await client?.fileManager.readFile('browser/' + filename)) || {}));
          }
        }),
      );

      arr.map((schema: { [key: string]: any }) => {
        if (schema.title === 'InstantiateMsg') {
          setSchemaInit(schema);
        } else if (schema.title === 'ExecuteMsg') {
          setSchemaExec(schema);
        } else if (schema.title === 'QueryMsg') {
          setSchemaQuery(schema);
          // using new schema
        } else if (schema.instantiate || schema.query || schema.exeucte) {
          setSchemaInit(schema.instantiate || {});
          setSchemaQuery(schema.query || {});
          setSchemaExec(schema.execute || {});
        }
      });
    } catch (e) {
      log.error(e);
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
          disabled={loading || !!fileName || !!codeID}
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
        disabled={account === '' || loading || !compileTarget}
        onClick={readCode}
        className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
      >
        <FaSyncAlt className={iconSpin} />
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
      ) : (
        false
      )}
      {wasm && !loading ? (
        <StoreCode
          providerInstance={providerInstance}
          wallet={wallet}
          compileTarget={compileTarget}
          client={client}
          wasm={wasm}
          setWasm={setWasm}
          checksum={checksum}
          txHash={txHash}
          setTxHash={setTxHash}
          codeID={codeID}
          setCodeID={setCodeID}
          schemaInit={schemaInit}
          schemaExec={schemaExec}
          schemaQuery={schemaQuery}
          account={account}
          timestamp={timestamp}
          providerNetwork={providerNetwork}
        />
      ) : (
        <>
          {/* need not this feature now */}
          {/* <p className="text-center" style={{ marginTop: '0px !important', marginBottom: '3px' }}>
            <small>NO COMPILED CONTRACT</small>
          </p>
          <p className="text-center" style={{ marginTop: '5px !important', marginBottom: '5px' }}>
            <small>OR</small>
          </p> */}
        </>
      )}
    </>
  );
};
