import { useEffect, useState } from 'react';
import { log } from '../../utils/logger';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { Compiler } from './Compiler';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import JSZip from 'jszip';

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};

interface InterfaceProps {
  client: any;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({ client }) => {
  const [projectName, setProjectName] = useState<string>('noname');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [compileTarget, setCompileTarget] = useState<string>('');
  const [template, setTemplate] = useState<string>('counter');
  const templateList = ['counter','dummy','atomic-order-example'];
  const [fileName, setFileName] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [contractAddressInputDraft, setContractAddressInputDraft] = useState<string>('');
  const [contractAddressError, setContractAddressError] = useState('');

  useEffect(() => {
    getList();
  }, []);

  useEffect(() => {
    client.on('fileManager', 'currentFileChanged', async (fileName: string) => {
      if (projectList && projectList.length != 0) {
        projectList.forEach((project) => {
          const splitProject = project.split('/');
          const projectMatch = fileName
            .split('/')
            .some((path: string) => splitProject[splitProject.length - 1] === path);
          if (projectMatch) {
            setCompileTarget(project);
            return;
          }
        });
      }
    });
    return () => {
      client.off('fileManager', 'currentFileChanged');
    };
  }, [projectList]);

  const getList = async () => {
    const projects = await getProjectHaveTomlFile('browser/injective');
    setProjectList(projects);
    setCompileTarget(projects[0]);
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
  const isExists = async (dir: string): Promise<boolean> => {
    try {
      const read: object = await client.fileManager.readdir('browser/injective/' + dir);
      return Object.keys(read).length > 0;
    } catch (e) {
      log.error(e);
      return false;
    }
  };
  const createProject = async () => {
    if (await isExists(projectName)) {
      await client.terminal.log({
        type: 'error',
        value:
          'The folder "injective/' +
          projectName +
          '" already exists. Please delete the existing project.',
      });
      return;
    }

    try {
      const path = 'browser/injective/' + projectName;
      await client?.fileManager.mkdir(path + '/src');
      await client?.fileManager.mkdir(path + '/examples');
      await client?.fileManager.writeFile(path + '/examples/schema.rs', '');
      await client?.fileManager.writeFile(path + '/Cargo.toml', '');
      await getList();
      await client.terminal.log({
        type: 'info',
        value: projectName + ' is created successfully.',
      });
    } catch (e: any) {
      console.error(e);
      await client.terminal.log({
        type: 'error',
        value: e.message,
      });
    }
  };

  const createTemplate = async () => {
    log.debug('create ' + template);

    if (await isExists(template)) {
      await client.terminal.log({
        type: 'error',
        value:
          'The folder "injective/' +
          template +
          '" already exists. Please delete the existing project.',
      });
      return;
    }

    const res = await axios.request({
      method: 'GET',
      url:
        `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=code-template&fileKey=injective/` +
        template +
        '.zip',
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
          await client?.fileManager.mkdir('browser/injective/' + key);
        } else if (!key.startsWith('_') && key !== template + '/.DS_Store') {
          const content = await zip.file(key)?.async('string');
          await client?.fileManager.writeFile('browser/injective/' + key, content);
        }
      });
      await getList();
      await client?.terminal.log({
        type: 'info',
        value: template + ' is created successfully.',
      });
    } catch (e: any) {
      console.error(e);
      await client.terminal.log({
        type: 'error',
        value: e.message,
      });
    }
  };

  const getProjectHaveTomlFile = async (path: string): Promise<string[]> => {
    if (!client) return [];

    const projects: string[] = [];

    const findTomlFileRecursively = async (currentPath: string): Promise<void> => {
      const list = await client.fileManager.readdir(currentPath);
      const hasTomlFile = Object.keys(list).some((item) => item.endsWith('Cargo.toml'));
      if (hasTomlFile) {
        projects.push(currentPath.replace('browser/', ''));
      }

      for (const [key, value] of Object.entries(list)) {
        if ((value as any).isDirectory) {
          const additionalPath = key.split('/').pop();
          await findTomlFileRecursively(currentPath + '/' + additionalPath);
        }
      }
    };

    await findTomlFileRecursively(path);

    return projects;
  };

  const reset = () => {
    setContractAddress('');
    setContractAddressInputDraft('');
    setContractAddressError('');
  };

  return (
    <div className="pb-4">
      <Form>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted mb-1">
            <small>NEW PROJECT</small>
          </Form.Text>
          <InputGroup>
            <Form.Control type="text" placeholder="Project Name" size="sm" onChange={setProject} />
            <Button variant="success" size="sm" onClick={createProject}>
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
            <Button variant="success" size="sm" onClick={createTemplate}>
              <small>Create</small>
            </Button>
          </InputGroup>
        </Form.Group>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted" style={mb4}>
            <small>TARGET PROJECT </small>
            <span onClick={getList}>
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
        compileTarget={compileTarget}
        client={client}
        reset={reset}
      />
    </div>
  );
};
