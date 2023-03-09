import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';

import { Compiler } from './Compiler';

import axios from 'axios';
import JSZip from 'jszip';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { log } from '../../utils/logger';

interface InterfaceProps {
  wallet: string;
  account: string;
  dapp: any;
  client: any;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({
  dapp,
  wallet,
  account,
  client,
}) => {
  const [projectName, setProjectName] = useState<string>('noname');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [compileTarget, setCompileTarget] = useState<string>('');
  const [template, setTemplate] = useState<string>('counter');
  const templateList = ['counter', 'to-do-list', 'name-service', 'cw20-pot'];
  const [contractAddress, setContractAddress] = useState<string>('');
  const [contractAddressInputDraft, setContractAddressInputDraft] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [contractAddressError, setContractAddressError] = useState('');

  useEffect(() => {
    getList();
  }, []);

  const getList = async () => {
    const list = await getProjectList();
    setProjectList(list);
    setCompileTarget(list[0]);
  };

  const setProject = (e: { target: { value: React.SetStateAction<string> } }) => {
    setProjectName(e.target.value);
  };

  const setTarget = (e: { target: { value: React.SetStateAction<string> } }) => {
    setCompileTarget(e.target.value);
  };

  const setTargetTemplate = (e: { target: { value: React.SetStateAction<string> } }) => {
    setTemplate(e.target.value);
  };

  const createProject = async () => {
    if (await isExists(projectName)) {
      await client.terminal.log('The folder "juno/' + projectName + '" already exists');
      return;
    }

    try {
      const path = 'browser/juno/' + projectName;
      await client?.fileManager.mkdir(path + '/src');
      await client?.fileManager.mkdir(path + '/examples');
      await client?.fileManager.writeFile(path + '/examples/schema.rs', '');
      await client?.fileManager.writeFile(path + '/Cargo.toml', '');
      getList();
    } catch (e: any) {
      await client.terminal.log(e.message);
    }

    getList();
  };

  const getProjectList = async () => {
    try {
      const list = await client?.fileManager.readdir('browser/juno/');
      return Object.keys(list || []);
    } catch (e) {
      log.error(e);
    }
    return [];
  };

  const isExists = async (dir: string) => {
    try {
      log.debug(await client.fileManager.readdir('browser/juno/' + dir));
      return true;
    } catch (e) {
      log.error(e);
      return false;
    }
  };

  const createTemplate = async () => {
    log.debug('create ' + template);

    if (await isExists(template)) {
      await client.terminal.log('The folder "juno/' + template + '" already exists');
      return;
    }

    const res = await axios.request({
      method: 'GET',
      url:
        `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=code-template&fileKey=juno/` + template + '.zip',
      responseType: 'arraybuffer',
      responseEncoding: 'null',
    });

    log.debug(res);

    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(res.data);

    log.debug(zip);
    try {
      Object.keys(zip.files).map(async (key) => {
        if (zip.files[key].dir) {
          await client?.fileManager.mkdir('browser/juno/' + key);
        } else if (!key.startsWith('_') && key !== template + '/.DS_Store') {
          const content = await zip.file(key)?.async('string');
          await client?.fileManager.writeFile('browser/juno/' + key, content);
        }
      });
      await getList();
      await client?.terminal.log((template + ' is created successfully.') as any);
    } catch (e) {
      log.error(e);
    }
  };

  // Need not this function now
  // const getContractAtAddress = () => {
  //   if (contractAddressInputDraft.slice(0, 4) !== 'juno') {
  //     setContractAddressError('Invalid contract address');
  //     return;
  //   }
  //   setContractAddress(contractAddressInputDraft);
  // };

  const reset = () => {
    setContractAddress('');
    setContractAddressInputDraft('');
    setContractAddressError('');
  };

  return (
    <div className="pb-4">
      <Form>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted" style={mb4}>
            <small>TEMPLATE CODE</small>
          </Form.Text>
          <InputGroup>
            <Form.Control as="select" value={template} onChange={setTargetTemplate}>
              {templateList.map((temp, idx) => {
                return (
                  <option value={temp} key={idx}>
                    {temp}
                  </option>
                );
              })}
            </Form.Control>
            <Button variant="success" size="sm" onClick={createTemplate}>
              <small>Create Template</small>
            </Button>
          </InputGroup>
        </Form.Group>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted mb-1">
            <small>PROJECT</small>
          </Form.Text>
          <InputGroup>
            <Form.Control type="text" placeholder="Project Name" size="sm" onChange={setProject} />
            <Button variant="success" size="sm" onClick={createProject}>
              <small>New Project</small>
            </Button>
          </InputGroup>
        </Form.Group>
        <Form.Group>
          <Form.Text className="text-muted mb-1 mt-2">
            <small>PROJECT TO COMPILE </small>
            <span onClick={getList}>
              <FaSyncAlt />
            </span>
          </Form.Text>
          <InputGroup>
            <Form.Control as="select" value={compileTarget} onChange={setTarget}>
              {projectList.map((projectName, idx) => {
                return (
                  <option value={projectName} key={idx}>
                    {projectName}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
        </Form.Group>
      </Form>
      <Compiler
        fileName={fileName}
        setFileName={setFileName}
        dapp={dapp}
        compileTarget={compileTarget}
        wallet={wallet}
        account={account}
        client={client}
        reset={reset}
      />

      {/* need not this 'at address' feature */}
      {/* {!fileName ? (
        <>
          <Form.Group>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Contract Address"
                size="sm"
                value={contractAddressInputDraft}
                onChange={(e) => {
                  setContractAddress('');
                  setContractAddressInputDraft(e.target.value);
                  setContractAddressError('');
                }}
                spellCheck={false}
              />
              <OverlayTrigger
                placement="top"
                overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract Address</Tooltip>}
              >
                <Button
                  variant="info"
                  size="sm"
                  disabled={account === ''}
                  onClick={getContractAtAddress}
                  className="mb-2"
                >
                  <small>At Address</small>
                </Button>
              </OverlayTrigger>
            </InputGroup>
          </Form.Group>
          {contractAddressError && <div style={{ color: 'red' }}>{contractAddressError}</div>}
        </>
      ) : (
        false
      )}
       */}
      {/* {!fileName && contractAddress && !contractAddressError ? (
        <Contract contractAddress={contractAddress || ''} />
      ) : (
        false
      )} */}
    </div>
  );
};

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};
