import React, { Dispatch, useEffect, useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { StoreCode } from './StoreCode';

import {
  compileId,
  COMPILER_JUNO_COMPILE_COMPLETED_V1,
  COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_JUNO_COMPILE_LOGGED_V1,
  CompilerJunoCompileCompletedV1,
  CompilerJunoCompileErrorOccurredV1,
  CompilerJunoCompileLoggedV1,
  REMIX_JUNO_COMPILE_REQUESTED_V1,
  RemixJunoCompileRequestedV1,
} from 'wds-event';
import { io } from 'socket.io-client';
import { COMPILER_API_ENDPOINT, JUNO_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import { getPositionDetails, isRealError, readFile, stringify } from '../../utils/helper';
import { log } from '../../utils/logger';
import { EditorClient } from '../../utils/editor';
import AlertCloseButton from '../common/AlertCloseButton';

interface InterfaceProps {
  fileName: string;
  setFileName: Dispatch<React.SetStateAction<string>>;
  compileTarget: string;
  wallet: string;
  account: string;
  dapp: any;
  client: any;
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
}) => {
  const [iconSpin, setIconSpin] = useState<string>('');
  const [wasm, setWasm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>('');

  const exists = async () => {
    try {
      const artifacts = await client?.fileManager.readdir(
        'browser/' + compileTarget + '/artifacts',
      );
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'artifacts' directory and click the Compile button again.",
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

  const readCode = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    if (await exists()) {
      await setSchemaObj();
    } else {
      setWasm('');
      setFileName('');
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
    }
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

    try {
      // socket connect
      const socket = io(JUNO_COMPILER_CONSUMER_ENDPOINT);

      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setIconSpin('');
        setLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerJunoCompileErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }
          await client.terminal.log({ type: 'error', value: data.errMsg.toString() });
          setIconSpin('');
          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_JUNO_COMPILE_LOGGED_V1, async (data: CompilerJunoCompileLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (data.compileId !== compileId(address, timestamp)) {
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
              // await editorClient.switchFile(`${compileTarget}/${file}`)
              await editorClient.gotoLine(positionDetail.row, positionDetail.col);
              // await editorClient.highlight(
              //   highlightPosition,
              //   `${compileTarget}/${file}`,
              //   '#ff7675',
              // );
              await editorClient.addAnnotation(annotation);

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

          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_JUNO_COMPILE_COMPLETED_V1} data=${stringify(data)}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          const bucket = 'juno-origin-code';
          const fileKey = `${address}/${timestamp}/out_${address}_${timestamp}_juno.zip`;
          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=${bucket}&fileKey=${fileKey}`,
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

          const zip = await new JSZip().loadAsync(res.data);

          try {
            await Promise.all(
              Object.keys(zip.files).map(async (filename) => {
                log.debug(`juno build result filename=${filename}`);
                if (getExtensionOfFilename(filename) === '.wasm') {
                  const fileData = await zip.files[filename].async('blob');

                  const wasmFile = await readFile(new File([fileData], filename));
                  log.debug(wasmFile);

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
      formData.append('address', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'juno');
      formData.append('zipFile', blob || '');
      const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
      });

      log.debug(res);

      if (res.status !== 201) {
        log.error(`src upload fail. address=${address}, timestamp=${timestamp}`);
        socket.disconnect();
        setIconSpin('');
        setLoading(false);
        return;
      }

      const remixJunoCompileRequestedV1: RemixJunoCompileRequestedV1 = {
        compileId: compileId(address, timestamp),
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'juno',
      };
      socket.emit(REMIX_JUNO_COMPILE_REQUESTED_V1, remixJunoCompileRequestedV1);
      log.debug(
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
      log.debug(compileTarget);
      const schemaPath = await client?.fileManager.readdir('browser/' + compileTarget + '/schema');
      log.debug(schemaPath);

      const schemaFiles = Object.keys(schemaPath || ['']);
      const arr: Object[] = [];

      await Promise.all(
        schemaFiles.map(async (filename: string) => {
          arr.push(JSON.parse((await client?.fileManager.readFile('browser/' + filename)) || ''));
        }),
      );
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
        disabled={account === ''}
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
          <Button
            size="sm"
            style={{ marginRight: '1em' }}
            onClick={() => {
              setFileName('');
              setWasm('');
            }}
          >
            Clear
          </Button>
          <small>{fileName}</small>
        </div>
      ) : (
        false
      )}
      {wasm ? (
        <StoreCode
          dapp={dapp}
          wallet={'Dsrv'}
          compileTarget={compileTarget}
          client={client}
          wasm={wasm}
          setWasm={setWasm}
        />
      ) : (
        false
      )}
    </>
  );
};
