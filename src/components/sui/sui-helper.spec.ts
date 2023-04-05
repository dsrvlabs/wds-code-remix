/**
 * @group unit
 */

// @ts-ignore
// import {ArgsAbi} from './ArgsAbi';
import { TextEncoder } from 'util';

global.TextEncoder = TextEncoder;

// require('../../../jest.config');

describe('Sui Helper', () => {
  it('isArray', async () => {
    console.log(Array.isArray('abc'));
  });
  it('split', async () => {
    const id = 'vec-arg-add-';
    console.log(`id`, id);
    const indices = id
      .slice('vec-arg-add-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));

    console.log('indices', indices);
  });
});
