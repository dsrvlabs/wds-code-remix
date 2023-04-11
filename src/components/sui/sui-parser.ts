import { log } from '../../utils/logger';

export function stringifySuiVectorType(t: any): string {
  let curVal = t;
  let cnt = 0;
  while (curVal) {
    cnt++;
    log.info(`cnt=${cnt}`);

    if (curVal.Struct) {
      curVal = curVal.Struct;
      log.info(`break cnt=${cnt}`);
      break;
    }

    if (typeof curVal.Vector === 'string' || curVal === undefined) {
      curVal = curVal.Vector;
      log.info(`break cnt=${cnt}`);
      break;
    }
    curVal = curVal.Vector;
  }

  const vectorCnt = typeof curVal === 'string' ? cnt : cnt - 1;
  let prefix = '';
  for (let i = 0; i < vectorCnt; i++) {
    prefix += 'Vector<';
  }

  const elTypeStr =
    typeof curVal === 'string' ? curVal : `${curVal.address}::${curVal.module}::${curVal.name}`;

  let postfix = '';
  for (let i = 0; i < vectorCnt; i++) {
    postfix += '>';
  }

  return prefix + elTypeStr + postfix;
}

export function stringifySuiVectorElementType(t: any): string {
  let curVal = t;
  let cnt = 0;
  while (curVal) {
    cnt++;
    log.info(`cnt=${cnt}`);

    if (curVal.Struct) {
      curVal = curVal.Struct;
      log.info(`break cnt=${cnt}`);
      break;
    }

    if (typeof curVal.Vector === 'string' || curVal === undefined) {
      curVal = curVal.Vector;
      log.info(`break cnt=${cnt}`);
      break;
    }
    curVal = curVal.Vector;
  }

  return typeof curVal === 'string'
    ? curVal
    : `${curVal.address}::${curVal.module}::${curVal.name}`;
}
