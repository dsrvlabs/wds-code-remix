import { readdirSync } from 'fs';
import { log } from './logger';

export interface FileInfo {
  path: string,
  isDirectory: boolean,
}

export class FileUtil {
  static findOneByExtension(path: string, extension: string) {
    return FileUtil.allFiles(path).find((path) => path.includes(`.${extension}`));
  }

  static allFiles(dirName: string) {
    let files: string[] = [];
    const items = readdirSync(dirName, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory()) {
        files = [...files, ...FileUtil.allFiles(`${dirName}/${item.name}`)];
      } else {
        files.push(`${dirName}/${item.name}`);
      }
    }

    return files;
  }

  static async allFilesForBrowser(client: any, dirName: string) : Promise<FileInfo[]> {
    let files: FileInfo[] = [];
    let items_;
    try {
      items_ = await client?.fileManager.readdir(
        'browser/' + dirName
      );
    } catch (e) {
      log.error(e)
      return []
    }

    for (const [key, value] of Object.entries(items_)) {
      files.push({
        path: key,
        isDirectory: (value as any).isDirectory,
      })
    }

    let result: FileInfo[]= [];
    for (const file of files) {
      if (file.isDirectory) {
        const subDirFiles = await FileUtil.allFilesForBrowser(client, file.path) || []
        result = [...files, ...subDirFiles];
      } else {
        result.push(file);
      }
    }
    return result;
  }

  static extractFilename(path: string): string {
    const lastIndex = path.lastIndexOf('/');
    if (lastIndex === -1) {
      return path;
    }

    return path.slice(lastIndex + 1);
  }

  static extractFilenameWithoutExtension(path: string): string {
    const filename = FileUtil.extractFilename(path);
    return filename.slice(0, filename.lastIndexOf('.'));
  }
}
