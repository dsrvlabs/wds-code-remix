import { Client } from '@remixproject/plugin';
import { HighlightPosition, Annotation, IRemixApi } from '@remixproject/plugin-api';
import { Api } from '@remixproject/plugin-utils';
import { log } from './logger';

export class EditorClient {
  client;

  constructor(client: Client<Api, Readonly<IRemixApi>>) {
    this.client = client;
    this.currentFileChanged();
  }

  getFile = async (name: string) => {
    let path = name.startsWith('./') ? name.substr(2) : name;
    return this.client.call('fileManager', 'getFile', this.getBrowserPath(path));
  };

  getFolder = async () => {
    return this.client.call('fileManager', 'getFolder', '/browser');
  };

  getCurrentFile = async () => {
    return this.client.call('fileManager', 'getCurrentFile');
  };

  createFile = async (name: string, content: string) => {
    try {
      await this.client.call('fileManager', 'setFile', name, content);
      await this.client.call('fileManager', 'switchFile', name);
    } catch (err) {
      log.error(err);
    }
  };

  currentFileChanged = async () => {
    this.client.on('fileManager', 'currentFileChanged', (file) => {
      this.discardHighlight();
      this.clearAnnotations();
    });
  };

  highlight = async (position: HighlightPosition, file: string, color: string) => {
    await this.client.call('editor', 'highlight', position, this.getBrowserPath(file), color, {
      focus: true,
    });
  };

  discardHighlight = async () => {
    await this.client.call('editor', 'discardHighlight');
  };

  gotoLine = async (row: number, col: number) => {
    await this.client.call('editor', 'gotoLine', row, col);
  };

  addAnnotation = async (annotatioin: Annotation) => {
    await this.client.call('editor', 'addAnnotation', annotatioin);
  };

  clearAnnotations = async () => {
    await this.client.call('editor', 'clearAnnotations');
  };

  switchFile = async (file: string) => {
    await this.client.call('fileManager', 'switchFile', this.getBrowserPath(file));
  };

  private getBrowserPath = (path: string) => {
    if (path.startsWith('browser')) {
      return path;
    }
    return `browser/${path}`;
  };
}

export const addErrorNotation = async (
  annotation: Annotation,
  highlightPosition: HighlightPosition,
  positionDetail: Record<string, number | number>,
  client: any,
) => {
  await client.editor.gotoLine(positionDetail.row, positionDetail.col);
  await client.editor.addAnnotation(annotation);
  await client.editor.highlightPosition(highlightPosition);
};
