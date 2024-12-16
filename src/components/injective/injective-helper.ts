export const recursiveValueChange = (obj: any, callback: any) => {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      recursiveValueChange(obj[key], callback);
    } else {
      obj[key] = callback(obj[key]);
    }
  }
};

export const stringToNumber = (value: any) => {
  if (!isNaN(value) && typeof value === 'string' && value.trim() !== '') {
    return parseFloat(value);
  }
  return value;
};

export const getConstructorInterface = (abi: string | any[]) => {
  const funABI: any = { name: '', inputs: [], type: 'constructor', payable: false, outputs: [] };
  if (typeof abi === 'string') {
    try {
      abi = JSON.parse(abi);
    } catch (e) {
      console.log('exception retrieving ctor abi ' + abi);
      return funABI;
    }
  }

  for (let i = 0; i < abi.length; i++) {
    if (abi[i].type === 'constructor') {
      funABI.inputs = abi[i].inputs || [];
      funABI.payable = abi[i].payable;
      funABI['stateMutability'] = abi[i].stateMutability;
      break;
    }
  }

  return funABI;
};

export const sortAbiFunction = (contractabi: any[]) => {
  // Check if function is constant (introduced with Solidity 0.6.0)
  const isConstant = ({ stateMutability }: any) =>
    stateMutability === 'view' || stateMutability === 'pure';
  // Sorts the list of ABI entries. Constant functions will appear first,
  // followed by non-constant functions. Within those t wo groupings, functions
  // will be sorted by their names.
  return contractabi.sort(function (a, b) {
    if (isConstant(a) && !isConstant(b)) {
      return 1;
    } else if (isConstant(b) && !isConstant(a)) {
      return -1;
    }
    // If we reach here, either a and b are both constant or both not; sort by name then
    // special case for fallback, receive and constructor function
    if (a.type === 'function' && typeof a.name !== 'undefined') {
      return a.name.localeCompare(b.name);
    } else if (a.type === 'constructor' || a.type === 'fallback' || a.type === 'receive') {
      return 1;
    }
  });
};
