import React, { Dispatch, useEffect, useState } from 'react';
import { log } from '../../utils/logger';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import JSZip from 'jszip';
import { EditorClient } from '../../utils/editor';
import { CHAIN_NAME } from '../../const/chain';
import axios from 'axios';
import { COMPILER_API_ENDPOINT, INJECTIVE_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import { io } from 'socket.io-client';
import { DisconnectDescription, Socket } from 'socket.io-client/build/esm/socket';
import { cleanupSocketInjective } from '../../socket';
import {
  COMPILER_INJECTIVE_COMPILE_COMPLETED_V1,
  COMPILER_INJECTIVE_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_INJECTIVE_COMPILE_LOGGED_V1,
  CompilerInjectiveCompileCompletedV1,
  CompilerInjectiveCompileErrorOccurredV1,
  CompilerInjectiveCompileLoggedV1,
  REMIX_INJECTIVE_COMPILE_REQUESTED_V1,
  RemixInjectiveCompileRequestedV1,
  compileIdV2,
} from 'wds-event';
import { getPositionDetails, isRealError, readFile, stringify } from '../../utils/helper';
import { UploadUrlDto } from '../../types/dto/upload-url.dto';
import { S3Path } from '../../const/s3-path';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';
import { CustomTooltip } from '../common/CustomTooltip';
import { Alert, Button } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import AlertCloseButton from '../common/AlertCloseButton';
import { StoreCode } from './StoreCode';
import { useWalletStore } from './WalletContextProvider';

interface InterfaceProps {
  fileName: string;
  setFileName: Dispatch<React.SetStateAction<string>>;
  compileTarget: string;
  client: any;
  reset: () => void;
}

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  fileName,
  setFileName,
  client,
  compileTarget,
  reset,
}) => {
  const [iconSpin, setIconSpin] = useState<string>('');
  const [wasm, setWasm] = useState<string>('');
  const [checksum, setChecksum] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>('');
  const [codeID, setCodeID] = useState<string>('');
  const [timestamp, setTimestamp] = useState('');

  const [schemaInit, setSchemaInit] = useState<{ [key: string]: any }>({});
  const [schemaExec, setSchemaExec] = useState<Object>({});
  const [schemaQuery, setSchemaQuery] = useState<Object>({});

  const [uploadCodeChecked, setUploadCodeChecked] = useState(true);

  const { injectiveAddress, chainId } = useWalletStore();

  useEffect(() => {
    exists();
    setSchemaObj();
  }, [compileTarget]);

  const exists = async () => {
    try {
      const artifacts = await client?.fileManager.readdir(
        'browser/' + compileTarget + '/artifacts',
      );
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
    } catch (e: any) {
      client.terminal.log({ type: 'error', value: `${e.message}` });
    }
  };

  const init = () => {
    setWasm('');
    setChecksum('');
    setFileName('');
    setCodeID('');
    setSchemaExec({});
    setSchemaInit({});
    setSchemaQuery({});
    setTimestamp('');
  };

  const removeArtifacts = async () => {
    log.info(`removeArtifacts ${'browser/' + compileTarget + '/artifacts'}`);
    try {
      await client?.fileManager.remove('browser/' + compileTarget + '/artifacts');
    } catch (e) {
      log.info(`no out folder`);
    }
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
          const projFolderExcluded = chainFolderExcluded.substring(
            chainFolderExcluded.indexOf('/') + 1,
          );
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

    const address = injectiveAddress;
    const timestamp = Date.now().toString();
    setTimestamp(timestamp);

    let realChainId = chainId;

    const isSrcZipUploadSuccess = await FileUtil.uploadSrcZip({
      chainName: CHAIN_NAME.injective,
      chainId: realChainId,
      account: address || 'noaddress',
      timestamp: timestamp.toString() || '0',
      fileType: 'injective',
      zipFile: blob,
    });
    if (!isSrcZipUploadSuccess) {
      log.error(`src zip upload fail. address=${address}, timestamp=${timestamp}`);
      setIconSpin('');
      setLoading(false);
      return;
    }

    const projFiles_ = projFiles
      .filter((fileInfo) => {
        if (fileInfo.path === `${compileTarget}/artifacts` && fileInfo.isDirectory) {
          return false;
        }

        if (fileInfo.path.startsWith(`${compileTarget}/artifacts/`)) {
          return false;
        }

        if (fileInfo.path === `${compileTarget}/schema` && fileInfo.isDirectory) {
          return false;
        }

        if (fileInfo.path.startsWith(`${compileTarget}/schema/`)) {
          return false;
        }

        if (fileInfo.path.startsWith(`${compileTarget}/Cargo.lock`)) {
          return false;
        }
        return true;
      })
      .map((pf) => ({
        path: pf.path.replace(compileTarget + '/', ''),
        isDirectory: pf.isDirectory,
      }));

    const uploadUrls = await FileUtil.uploadUrls({
      chainName: CHAIN_NAME.injective,
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

    const socket = io(INJECTIVE_COMPILER_CONSUMER_ENDPOINT, {
      reconnection: false,
      transports: ['websocket'],
    });
    try {
      socket.on('connect_error', function (err) {
        log.debug('Error connecting to server');
        setLoading(false);
        socket.disconnect();
      });

      socket.on('connect', async () => {});

      socket.on(
        'disconnect',
        (reason: Socket.DisconnectReason, description?: DisconnectDescription) => {
          log.info('[SOCKET.INJECTIVE] disconnected.', reason, description);
          setIconSpin('');
          setLoading(false);
          log.info(`@@@ after disconnect. disconnected=${socket.disconnected}`);
          cleanupSocketInjective(socket);
        },
      );

      socket.on('connect_error', function (err) {
        // handle server error here
        log.info('[SOCKET.INJECTIVE] Error connecting to server');
        log.error(err);
        setIconSpin('');
        setLoading(false);
        log.info(`@@@ after connect_error. disconnected=${socket.disconnected}`);
        cleanupSocketInjective(socket);
        client.terminal.log({
          type: 'error',
          value: `${err.message}`,
        });
      });

      socket.on(
        COMPILER_INJECTIVE_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerInjectiveCompileErrorOccurredV1) => {
          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.injective,
                  chainId: realChainId,
                  account: injectiveAddress,
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
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_INJECTIVE_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.injective, realChainId, address, timestamp)
          ) {
            return;
          }
          await client.terminal.log({ type: 'error', value: data.errMsg.toString() });
          setIconSpin('');
          setLoading(false);
          socket.disconnect();
          cleanupSocketInjective(socket);
        },
      );

      socket.on(
        COMPILER_INJECTIVE_COMPILE_LOGGED_V1,
        async (data: CompilerInjectiveCompileLoggedV1) => {
          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_INJECTIVE_COMPILE_LOGGED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.injective, realChainId, address, timestamp)
          ) {
            return;
          }

          await client.terminal.log({ type: 'info', value: data.logMsg });

          if (data.logMsg.includes('error')) {
            const { file, annotation, highlightPosition, positionDetail } = getPositionDetails(
              data.logMsg,
            );

            if (file) {
              if (isRealError(annotation)) {
                await editorClient.addAnnotation(annotation);
                await editorClient.gotoLine(positionDetail.row, positionDetail.col);
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
        COMPILER_INJECTIVE_COMPILE_COMPLETED_V1,
        async (data: CompilerInjectiveCompileCompletedV1) => {
          socket.disconnect();

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_INJECTIVE_COMPILE_COMPLETED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !== compileIdV2(CHAIN_NAME.injective, realChainId, address, timestamp)
          ) {
            return;
          }

          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              bucket: S3Path.bucket(),
              fileKey: S3Path.outKey(
                CHAIN_NAME.injective,
                realChainId,
                injectiveAddress,
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
                  chainName: CHAIN_NAME.injective,
                  chainId: realChainId,
                  account: injectiveAddress,
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
                log.info(`injective build result filename=${filename}`);
                if (getExtensionOfFilename(filename) === '.wasm') {
                  const fileData = await zip.files[filename].async('blob');
                  const wasmFile = await readFile(new File([fileData], filename));
                  log.info(wasmFile);
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
                  chainName: CHAIN_NAME.injective,
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

      const remixInjectiveCompileRequestedV1: RemixInjectiveCompileRequestedV1 = {
        compileId: compileIdV2(CHAIN_NAME.injective, realChainId, address, timestamp),
        chainName: CHAIN_NAME.injective,
        chainId: realChainId,
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'injective',
      };

      socket.emit(REMIX_INJECTIVE_COMPILE_REQUESTED_V1, remixInjectiveCompileRequestedV1);
      log.info(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_INJECTIVE_COMPILE_REQUESTED_V1} data=${stringify(
          remixInjectiveCompileRequestedV1,
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
        disabled={injectiveAddress === '' || loading || !compileTarget}
        onClick={readCode}
        className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
      >
        <FaSyncAlt className={iconSpin} />
        <span> Compile {compileTarget}</span>
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
          compileTarget={compileTarget}
          client={client}
          wasm={wasm}
          setWasm={setWasm}
          checksum={checksum}
          codeID={codeID}
          setCodeID={setCodeID}
          schemaInit={schemaInit}
          schemaExec={schemaExec}
          schemaQuery={schemaQuery}
          timestamp={timestamp}
        />
      ) : (
        <>
          {/* not need this feature now */}
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
