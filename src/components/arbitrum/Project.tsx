import React, { useEffect, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';

// import { Compiler } from './Compiler';
import axios from 'axios';
import JSZip from 'jszip';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { Compiler } from './Compiler';

interface InterfaceProps {
  wallet: string;
  account: string;
  client: Client<Api, Readonly<IRemixApi>>;
  injectedProvider: any;
  providerNetwork: string;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({
  wallet,
  account,
  injectedProvider,
  providerNetwork,
  client,
}) => {
  const [projectName, setProjectName] = useState<string>('noname');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [compileTarget, setCompileTarget] = useState<string>('');
  const [template, setTemplate] = useState<string>('hello-world');
  const [fileName, setFileName] = useState<string>('');

  const templateList = ['hello-world'];

  useEffect(() => {
    getList();
  }, []);

  const getList = async () => {
    const list = await getProjectList();
    setProjectList(list);
    list?.length > 0 && setCompileTarget(list[0]);
  };

  const wrappedGetList = () => wrapPromise(getList(), client);

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
    sendCustomEvent('new_project', {
      event_category: 'arbitrum',
      method: 'new_project',
    });
    if (await wrappedIsExists(projectName)) {
      await client.terminal.log({
        type: 'error',
        value: 'The folder "arbitrum/' + projectName + '" already exists',
      });
      return;
    }

    try {
      const path = 'browser/arbitrum/' + projectName;
      await client?.fileManager.mkdir(path + '/src');
      await client?.fileManager.mkdir(path + '/examples');
      await client?.fileManager.mkdir(path + '/.cargo/config');
      await client?.fileManager.writeFile(path + '/Cargo.toml', '');
      getList();
    } catch (e: any) {
      await client.terminal.log(e.message);
    }
  };
  const wrappedCreateProject = () => wrapPromise(createProject(), client);

  const getProjectList = async () => {
    try {
      const list = await client?.fileManager.readdir('browser/arbitrum/');
      return Object.keys(list || []);
    } catch (e) {
      log.error(e);
    }
    return [];
  };

  // const wrappedGetProjectList = () => wrapPromise(getProjectList(), client);

  const isExists = async (dir: string) => {
    try {
      log.debug(await client.fileManager.readdir('browser/arbitrum/' + dir));
      return true;
    } catch (e) {
      log.error(e);
      return false;
    }
  };

  const wrappedIsExists = (dir: string) => wrapPromise(isExists(dir), client);

  const createTemplate = async () => {
    sendCustomEvent('create_template', {
      event_category: 'arbitrum',
      method: 'create_template',
    });

    if (await wrappedIsExists(template)) {
      await client.terminal.log({
        type: 'error',
        value: `The folder "arbitrum/${template} already exists`,
      });
      return;
    }

    const res = await axios.request({
      method: 'GET',
      url:
        `https://api.welldonestudio.io/compiler/s3Proxy?bucket=code-template&fileKey=arbitrum/` +
        template +
        '.zip',
      responseType: 'arraybuffer',
      responseEncoding: 'null',
    });

    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(res.data);

    let content: any;
    try {
      Object.keys(zip.files).map(async (key) => {
        log.debug(`@@@ key=${key}`);
        if (zip.files[key].dir) {
          await client?.fileManager.mkdir('browser/arbitrum/' + key);
        } else if (!key.startsWith('_') && key !== template + '/.DS_Store') {
          content = await zip.file(key)?.async('string');
          await client?.fileManager.writeFile('browser/arbitrum/' + key, content);
        }
      });
      await wrappedGetList();
      await client.terminal.log({ type: 'info', value: template + ' is created successfully.' });
    } catch (e) {
      log.error(e);
    }
  };

  const wrappedCreateTemplate = () => wrapPromise(createTemplate(), client);

  return (
    <div>
      <Form>
        <div>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>NEW PROJECT</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Project Name"
                size="sm"
                onChange={setProject}
              />
              <Button variant="success" size="sm" onClick={wrappedCreateProject}>
                <small>Create</small>
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>SELECT A TEMPLATE</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={template}
                onChange={setTargetTemplate}
              >
                {templateList.map((temp, idx) => {
                  return (
                    <option value={temp} key={idx}>
                      {temp}
                    </option>
                  );
                })}
              </Form.Control>
              <Button variant="success" size="sm" onClick={wrappedCreateTemplate}>
                <small>Create</small>
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>TARGET PROJECT </small>
              <span onClick={wrappedGetList}>
                <FaSyncAlt />
              </span>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={compileTarget}
                onChange={setTarget}
              >
                {projectList?.map((projectName, idx) => {
                  return (
                    <option value={projectName} key={idx}>
                      {projectName}
                    </option>
                  );
                })}
              </Form.Control>
            </InputGroup>
          </Form.Group>
        </div>
      </Form>

      <hr />
      <Compiler
        fileName={fileName}
        setFileName={setFileName}
        providerInstance={injectedProvider}
        compileTarget={compileTarget}
        wallet={wallet}
        account={account}
        client={client}
        providerNetwork={providerNetwork}
      />
    </div>
  );
};

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};
