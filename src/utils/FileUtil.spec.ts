/**
 * @group unit
 */
import { FileUtil } from './FileUtil';
import { log } from './logger';

describe('FileUtil', () => {
  it('allFiles', () => {
    log.debug(FileUtil.allFiles('uploads/abc/1667179398858/build'));
  });

  it('extractFilename slash included', () => {
    const path = 'a/b.txt';

    const result = FileUtil.extractFilename(path);

    expect(result).toBe('b.txt');
  });

  it('extractFilename slash not included', () => {
    const path = 'b.txt';

    const result = FileUtil.extractFilename(path);

    expect(result).toBe('b.txt');
  });
});
