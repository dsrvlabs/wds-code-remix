import React, { useState } from 'react';
import { Alert, Button } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { Deploy } from './Deploy';
import { io } from 'socket.io-client';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';

import {
  compileId,
  COMPILER_APTOS_COMPILE_COMPLETED_V1,
  COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_APTOS_COMPILE_LOGGED_V1,
  CompilerAptosCompileCompletedV1,
  CompilerAptosCompileErrorOccurredV1,
  CompilerAptosCompileLoggedV1,
  REMIX_APTOS_COMPILE_REQUESTED_V1,
  RemixAptosCompileRequestedV1,
} from 'wds-event';

import { APTOS_COMPILER_CONSUMER_ENDPOINT, COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { AptosClient, BCS, HexString, TxnBuilderTypes } from 'aptos';
import { FileUtil } from '../../utils/FileUtil';
import { readFile, stringify } from '../../utils/helper';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

interface InterfaceProps {
  compileTarget: string;
  accountID: string;
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  client,
  compileTarget,
  accountID,
  dapp,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [compileIconSpin, setCompileIconSpin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>(null);
  const [rawTx, setRawTx] = useState('');

  const [moduleBase64, setModuleBase64] = useState<string>('');
  const [metaData64, setMetaDataBase64] = useState<string>('');

  const exists = async () => {
    try {
      const artifacts = await client?.fileManager.readdir('browser/' + compileTarget + '/out');
      log.debug(artifacts);
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'out' directory and click the Compile button again.",
      });

      const artifactPaths = Object.keys(artifacts || {});
      log.debug(artifactPaths);
      let moduleBase64 = '';
      let metaData64 = '';
      await Promise.all(
        artifactPaths.map(async (path) => {
          if (getExtensionOfFilename(path) === '.mv') {
            moduleBase64 = await client?.fileManager.readFile('browser/' + path);
            log.debug(`mvFile=${moduleBase64}`);
            setModuleBase64(moduleBase64 || '');
            setFileName(path);
          }

          if (path.includes('package-metadata.bcs')) {
            metaData64 = await client?.fileManager.readFile('browser/' + path);
            log.debug(`metaData64=${metaData64}`);
            setMetaDataBase64(metaData64 || '');
          }
        }),
      );

      if (metaData64 && moduleBase64) {
        const _tx = await genRawTx(
          Buffer.from(metaData64, 'base64'),
          Buffer.from(moduleBase64, 'base64'),
          accountID,
        );
        setRawTx(_tx);
        return true;
      } else {
        return false;
      }
    } catch (e: any) {
      await client.terminal.log({
        type: 'error',
        value: e.toString(),
      });
      return false;
    }
  };

  const readCode = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    if (!(await exists())) {
      setModuleBase64('');
      setFileName('');
      const toml = compileTarget + '/Move.toml';
      log.debug(`toml=${toml}`);

      const sourceFiles = await client?.fileManager.readdir(
        'browser/' + compileTarget + '/sources',
      );
      const sourceFilesNames = Object.keys(sourceFiles || {});
      log.debug(`sourceFilesNames=${sourceFilesNames}`);
      const filesNames = sourceFilesNames.concat(toml);
      log.debug(`filesNames=${filesNames}`);

      let code;
      const fileList = await Promise.all(
        filesNames.map(async (f) => {
          code = await client?.fileManager.getFile(f);
          return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
        }),
      );

      generateZip(fileList);
    }
  };

  const wrappedReadCode = () => wrapPromise(readCode(), client);

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const generateZip = (fileList: Array<any>) => {
    const zip = new JSZip();
    fileList.map((file) => {
      log.debug(`@@@ file=${file}`);

      if (file.name === 'Move.toml') {
        zip.file(file.name, file as any);
      } else {
        zip.folder('sources')?.file(file.name, file as any);
      }
    });

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      wrappedCompile(blob);
    });
  };

  const compile = async (blob: Blob) => {
    setCompileError(null);
    sendCustomEvent('compile', {
      event_category: 'aptos',
      method: 'compile',
    });
    setCompileIconSpin('fa-spin');
    setLoading(true);

    const address = accountID;
    const timestamp = Date.now().toString();
    try {
      // socket connect
      const socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT);

      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setCompileIconSpin('');
        setLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerAptosCompileErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          setCompileIconSpin('');
          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_APTOS_COMPILE_LOGGED_V1, async (data: CompilerAptosCompileLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (data.compileId !== compileId(address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: data.logMsg, type: 'info' });
      });

      socket.on(
        COMPILER_APTOS_COMPILE_COMPLETED_V1,
        async (data: CompilerAptosCompileCompletedV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_COMPLETED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          const bucket = 'aptos-origin-code';
          const fileKey = `${address}/${timestamp}/out_${address}_${timestamp}_move.zip`;
          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=${bucket}&fileKey=${fileKey}`,
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });
          //
          // const zip = await new JSZip().loadAsync(res.data);
          // let content: any;

          const zip = await new JSZip().loadAsync(res.data);
          await client?.fileManager.mkdir('browser/' + compileTarget + '/out');

          let packageMetadataBuf: Buffer | undefined;
          let moduleDataBuf: Buffer | undefined;

          await Promise.all(
            Object.keys(zip.files).map(async (key) => {
              log.debug(key);
              if (key.match('\\w+\\/bytecode_modules\\/\\w+.mv')) {
                moduleDataBuf = await zip.file(key)?.async('nodebuffer');
                log.debug(`moduleDataBuf=${moduleDataBuf?.toString('hex')}`);
                let content = await zip.file(key)?.async('blob');
                content = content?.slice(0, content.size) ?? new Blob();
                const moduleBase64 = await readFile(new File([content], key));
                log.debug(`moduleBase64=${moduleBase64}`);

                setModuleBase64(moduleBase64);
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  moduleBase64,
                );
                setFileName(key);
              }

              if (key.includes('package-metadata.bcs')) {
                let content = await zip.file(key)?.async('blob');
                content = content?.slice(0, content.size) ?? new Blob();
                const metadataFile = await readFile(new File([content], key));
                setMetaDataBase64(metadataFile);
                log.debug(`metadataFile_Base64=${metadataFile}`);
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  metadataFile,
                );

                packageMetadataBuf = await zip.file(key)?.async('nodebuffer');
                log.debug(`packageMetadata=${packageMetadataBuf?.toString('hex')}`);
                log.debug(packageMetadataBuf);
              }
            }),
          );

          if (packageMetadataBuf && moduleDataBuf) {
            const _tx = await genRawTx(packageMetadataBuf, moduleDataBuf, accountID);
            setRawTx(_tx);
          }

          socket.disconnect();
          setCompileIconSpin('');
          setLoading(false);
        },
      );

      const formData = new FormData();
      formData.append('address', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'move');
      formData.append('zipFile', blob || '');

      const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
      });

      if (res.status !== 201) {
        log.error(`src upload fail. address=${address}, timestamp=${timestamp}`);
        socket.disconnect();
        setCompileIconSpin('');
        setLoading(false);
        return;
      }

      const remixAptosCompileRequestedV1: RemixAptosCompileRequestedV1 = {
        compileId: compileId(address, timestamp),
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_APTOS_COMPILE_REQUESTED_V1, remixAptosCompileRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_APTOS_COMPILE_REQUESTED_V1} data=${stringify(
          remixAptosCompileRequestedV1,
        )}`,
      );
    } catch (e) {
      setLoading(false);
      log.error(e);
      setCompileIconSpin('');
    }
  };

  const wrappedCompile = (blob: Blob) => wrapPromise(compile(blob), client);

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    return filename.substring(_lastDot, _fileLen).toLowerCase();
  };

  return (
    <>
      <div className="d-grid gap-2">
        <Button
          variant="primary"
          disabled={accountID === ''}
          onClick={() => {
            wrappedReadCode();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          // onClick={setSchemaObj}
        >
          <FaSyncAlt className={compileIconSpin} />
          <span> Compile</span>
        </Button>
        <small>{fileName}</small>
        {compileError && (
          <Alert
            variant="danger"
            className="mt-3"
            style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            {compileError}
          </Alert>
        )}
      </div>
      <hr />
      <Deploy
        wallet={'Dsrv'}
        accountID={accountID}
        rawTx={rawTx}
        metaData64={metaData64}
        moduleBase64={moduleBase64}
        dapp={dapp}
        client={client}
      />
    </>
  );
};

async function genRawTx(packageMetadataBuf: Buffer, moduleDataBuf: Buffer, accountID: string) {
  const aptosClient = new AptosClient('https://fullnode.devnet.aptoslabs.com');

  const packageMetadata = new HexString(packageMetadataBuf.toString('hex')).toUint8Array();
  const modules = [
    new TxnBuilderTypes.Module(new HexString(moduleDataBuf.toString('hex')).toUint8Array()),
  ];

  const codeSerializer = new BCS.Serializer();
  BCS.serializeVector(modules, codeSerializer);

  const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
    TxnBuilderTypes.EntryFunction.natural(
      '0x1::code',
      'publish_package_txn',
      [],
      [BCS.bcsSerializeBytes(packageMetadata), codeSerializer.getBytes()],
    ),
  );

  const rawTransaction = await aptosClient.generateRawTransaction(
    new HexString(accountID),
    payload,
  );

  const rawTx = BCS.bcsToBytes(rawTransaction);
  return Buffer.from(rawTx).toString('hex');
}
