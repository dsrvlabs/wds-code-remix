export interface UploadUrlDto {
  fileKey: UploadTargetPath;
  url: string;
}

export interface UploadTargetPath {
  path: string; // Move.toml, sources, sources/executor_cap.move
  isDirectory: boolean;
}
