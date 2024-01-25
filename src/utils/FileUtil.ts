import { readdirSync } from 'fs';
import { log } from './logger';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../const/endpoint';
import { UploadUrlDto } from '../types/dto/upload-url.dto';

export interface FileInfo {
  path: string;
  isDirectory: boolean;
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

  static async allFilesForBrowser(client: any, dirName: string): Promise<FileInfo[]> {
    try {
      let result: FileInfo[] = [];
      const files = await client?.fileManager.readdir('browser/' + dirName);
      for (const [key, val] of Object.entries(files)) {
        const file_ = {
          path: key,
          isDirectory: (val as any).isDirectory,
        };
        if (file_.isDirectory) {
          const subDirFiles = (await FileUtil.allFilesForBrowser(client, file_.path)) || [];

          result = [...result, file_, ...subDirFiles];
        } else {
          result.push(file_);
        }
      }
      return result;
    } catch (e) {
      log.error(e);
      return [];
    }
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

  static async uploadSrcZip(srcZipUploadReq: {
    chainName: string;
    chainId: string;
    account: string;
    timestamp: string;
    fileType: string;
    zipFile: Blob;
  }) {
    const formData = new FormData();
    formData.append('chainName', srcZipUploadReq.chainName);
    formData.append('chainId', srcZipUploadReq.chainId);
    formData.append('account', srcZipUploadReq.account);
    formData.append('timestamp', srcZipUploadReq.timestamp);
    formData.append('fileType', srcZipUploadReq.fileType);
    formData.append('zipFile', srcZipUploadReq.zipFile);
    const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src-v2', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Accept: 'application/json',
      },
    });

    return res.status === 201;
  }

  static async uploadUrls(srcZipUploadReq: {
    chainName: string;
    chainId: string;
    account: string;
    timestamp: string;
    projFiles: FileInfo[];
  }): Promise<UploadUrlDto[]> {
    const uploadUrlsRes = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/upload-urls', {
      chainName: srcZipUploadReq.chainName,
      chainId: srcZipUploadReq.chainId,
      account: srcZipUploadReq.account || 'noaddress',
      timestamp: srcZipUploadReq.timestamp.toString() || '0',
      paths: srcZipUploadReq.projFiles.map((f) => ({
        path: f.path,
        isDirectory: f.isDirectory,
      })),
    });

    if (uploadUrlsRes.status !== 201) {
      log.error(
        `src upload url fail. account=${srcZipUploadReq.account}, timestamp=${srcZipUploadReq.timestamp}`,
      );
      return [];
    }

    return uploadUrlsRes.data as UploadUrlDto[];
  }

  static async contents(fileManager: any, compileTarget: string, projFiles: FileInfo[]) {
    return await Promise.all(
      projFiles.map(async (u) => {
        if (u.isDirectory) {
          return '';
        }
        return await fileManager.readFile('browser/' + compileTarget + '/' + u.path);
      }),
    );
  }
}
