import React, { Dispatch, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { StoreCode } from './StoreCode';

import {
  compileIdV2,
  COMPILER_JUNO_COMPILE_COMPLETED_V1,
  COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_JUNO_COMPILE_LOGGED_V1,
  CompilerJunoCompileCompletedV1,
  CompilerJunoCompileErrorOccurredV1,
  CompilerJunoCompileLoggedV1,
  REMIX_JUNO_COMPILE_REQUESTED_V1,
  RemixJunoCompileRequestedV1,
} from 'wds-event';
import { COMPILER_API_ENDPOINT, JUNO_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import { getPositionDetails, isRealError, readFile, stringify } from '../../utils/helper';
import { log } from '../../utils/logger';
import { EditorClient } from '../../utils/editor';
import AlertCloseButton from '../common/AlertCloseButton';
import { DisconnectDescription, Socket } from 'socket.io-client/build/esm/socket';
import { cleanupSocketJuno } from '../../socket';
import { io } from 'socket.io-client';
import { CHAIN_NAME } from '../../const/chain';
import { S3Path } from '../../const/s3-path';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';

interface InterfaceProps {
  fileName: string;
  setFileName: Dispatch<React.SetStateAction<string>>;
  compileTarget: string;
  wallet: string;
  account: string;
  dapp: any;
  client: any;
  reset: () => void;
}

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  fileName,
  setFileName,
  client,
  dapp,
  compileTarget,
  wallet,
  account,
  reset,
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

  const readCode = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    await removeArtifacts();
    init();

    // if (await exists()) {
    //   await setSchemaObj();
    // } else {

    const toml = compileTarget + '/Cargo.toml';
    const schema = compileTarget + '/examples/schema.rs';

    const sourceFiles = await client?.fileManager.readdir('browser/' + compileTarget + '/src');
    const sourceFilesName = Object.keys(sourceFiles || {});

    const filesName = sourceFilesName.concat(toml, schema);

    let code;
    const fileList = await Promise.all(
      filesName.map(async (f) => {
        code = await client?.fileManager.getFile(f);
        return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
      }),
    );

    generateZip(fileList);
    // }
  };

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const generateZip = (fileList: Array<any>) => {
    const zip = new JSZip();
    // eslint-disable-next-line array-callback-return
    fileList.map((file) => {
      if (file.name === 'Cargo.toml') {
        zip.file(file.name, file as any);
      } else if (file.name === 'schema.rs') {
        zip.folder('examples')?.file(file.name, file as any);
      } else {
        zip.folder('src')?.file(file.name, file as any);
      }
    });
    zip.generateAsync({ type: 'blob' }).then((blob) => {
      compile(blob);
    });
  };

  const compile = async (blob: Blob) => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    setLoading(true);
    setIconSpin('fa-spin');
    setCompileError('');

    const address = account;
    const timestamp = Date.now().toString();
    setTimestamp(timestamp);
    // const socketJuno = io(JUNO_COMPILER_CONSUMER_ENDPOINT, {
    //   timeout: 40_000,
    //   ackTimeout: 300_000,
    //   reconnection: false,
    //   transports: ['websocket'],
    // });

    const socket = io(JUNO_COMPILER_CONSUMER_ENDPOINT, {
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
          log.info('[SOCKET.JUNO] disconnected.', reason, description);
          setIconSpin('');
          setLoading(false);
          log.info(`@@@ after disconnect. disconnected=${socket.disconnected}`);
          cleanupSocketJuno(socket);
        },
      );

      socket.on('connect_error', function (err) {
        // handle server error here
        log.info('[SOCKET.JUNO] Error connecting to server');
        log.error(err);
        setIconSpin('');
        setLoading(false);
        log.info(`@@@ after connect_error. disconnected=${socket.disconnected}`);
        cleanupSocketJuno(socket);
        client.terminal.log({
          type: 'error',
          value: `${err.message}`,
        });
      });

      socket.on(
        COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerJunoCompileErrorOccurredV1) => {
          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !==
            compileIdV2(CHAIN_NAME.juno, dapp.networks.juno.chain, address, timestamp)
          ) {
            return;
          }
          await client.terminal.log({ type: 'error', value: data.errMsg.toString() });
          setIconSpin('');
          setLoading(false);
          socket.disconnect();
          cleanupSocketJuno(socket);
        },
      );

      socket.on(COMPILER_JUNO_COMPILE_LOGGED_V1, async (data: CompilerJunoCompileLoggedV1) => {
        log.info(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (
          data.compileId !==
          compileIdV2(CHAIN_NAME.juno, dapp.networks.juno.chain, address, timestamp)
        ) {
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
      });

      socket.on(
        COMPILER_JUNO_COMPILE_COMPLETED_V1,
        async (data: CompilerJunoCompileCompletedV1) => {
          socket.disconnect();

          log.info(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_COMPLETED_V1} data=${stringify(data)}`,
          );
          if (
            data.compileId !==
            compileIdV2(CHAIN_NAME.juno, dapp.networks.juno.chain, address, timestamp)
          ) {
            return;
          }

          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              bucket: S3Path.bucket(),
              fileKey: S3Path.outKey(
                CHAIN_NAME.juno,
                dapp.networks.juno.chain,
                account,
                timestamp,
                BUILD_FILE_TYPE.rs,
              ),
            },
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

          const zip = await new JSZip().loadAsync(res.data);

          try {
            await Promise.all(
              Object.keys(zip.files).map(async (filename) => {
                log.info(`juno build result filename=${filename}`);
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
          } catch (e) {
            log.error(e);
          } finally {
            setIconSpin('');
            setLoading(false);
          }
        },
      );

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.juno);
      formData.append('chainId', dapp.networks.juno.chain);
      formData.append('account', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'juno');
      formData.append('zipFile', blob || '');
      const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src-v2', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
      });

      log.info(res);

      if (res.status !== 201) {
        log.error(`src upload fail. address=${address}, timestamp=${timestamp}`);
        socket.disconnect();
        setIconSpin('');
        setLoading(false);
        return;
      }

      const remixJunoCompileRequestedV1: RemixJunoCompileRequestedV1 = {
        compileId: compileIdV2(CHAIN_NAME.juno, dapp.networks.juno.chain, address, timestamp),
        chainName: CHAIN_NAME.juno,
        chainId: dapp.networks.juno.chain,
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'juno',
      };

      socket.emit(REMIX_JUNO_COMPILE_REQUESTED_V1, remixJunoCompileRequestedV1);
      log.info(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_JUNO_COMPILE_REQUESTED_V1} data=${stringify(
          remixJunoCompileRequestedV1,
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
      <Button
        variant="primary"
        disabled={account === '' || loading || !compileTarget}
        onClick={readCode}
        className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
      >
        <FaSyncAlt className={iconSpin} />
        <span> Compile</span>
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
          dapp={dapp}
          wallet={'Dsrv'}
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
