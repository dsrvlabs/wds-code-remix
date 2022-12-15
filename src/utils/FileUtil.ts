import { readdirSync } from 'fs';

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

  static extractFilename(path: string): string {
    const lastIndex = path.lastIndexOf('/');
    if (lastIndex === -1) {
      return path;
    }

    return path.slice(lastIndex + 1);
  }
}
