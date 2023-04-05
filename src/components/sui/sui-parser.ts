export function parseSuiVectorType(t: any): string {
  let str = '';
  let curVal = t;
  let cnt = 0;
  while (curVal) {
    cnt++;
    str += `Vector<`;
    if (typeof curVal.Vector === 'string' || curVal === undefined) {
      curVal = curVal.Vector;
      break;
    }
    curVal = curVal.Vector;
  }

  let closingStr = '';
  for (let i = 0; i < cnt; i++) {
    closingStr += '>';
  }

  return str + curVal + closingStr;
}
