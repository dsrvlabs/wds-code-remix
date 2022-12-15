import { AbiInput, AbiItem, AbiOutput } from 'web3-utils';
import { JSONSchema7, JSONSchema7Definition } from 'json-schema';
import { InterfaceContract } from '../../utils/Types';
import * as abi from 'near-abi';

/** Convert near-abi-js schema format to compatible with JSONSchema7 */
export const Converter = (nearAbi: abi.AbiRoot, address: string) => {
  const parseOutputType: any = (type_schema: JSONSchema7) => {
    if (type_schema === undefined) {
      return '';
    }
    if (type_schema.$ref) {
      const arr = type_schema.$ref.split('/');
      const type = parseOutputType((nearAbi.body.root_schema as any)[arr[1]][arr[2]]);
      return type;
    } else {
      if (Array.isArray(type_schema.type)) {
        return type_schema.type.join(' | ');
      }
      return type_schema.type;
    }
  };

  // parse type & internalType
  const parseInputTypes = (jsonSchema: JSONSchema7) => {
    let type: string = '';
    let internalType: string = '';

    if (jsonSchema.type) {
      type = Array.isArray(jsonSchema.type) ? jsonSchema.type.join(' | ') : jsonSchema.type;
      internalType = jsonSchema.format ? jsonSchema.format : type;
    } else if (jsonSchema.$ref) {
      const reference = jsonSchema.$ref.split('/');
      internalType = reference[2];
      if (nearAbi.body.root_schema.definitions) {
        type = parseInputTypes(
          nearAbi.body.root_schema.definitions[internalType] as JSONSchema7,
        ).type;
      }
    } else if (jsonSchema.anyOf) {
      const types = jsonSchema.anyOf.map((anyOfJsonSchema: JSONSchema7Definition) => {
        return parseInputTypes(anyOfJsonSchema as JSONSchema7);
      });
      type = types.map((t) => t.type).join(' | ');
      internalType = types.map((i) => i.internalType).join(' | ');
    }
    return {
      type: type,
      internalType: internalType,
    };
  };

  const parseObject = (jsonSchema: JSONSchema7): AbiInput[] | undefined => {
    let properties: {
      [key: string]: JSONSchema7Definition;
    };
    let additionalProperties: JSONSchema7Definition | undefined;
    properties = jsonSchema.properties!;
    additionalProperties = jsonSchema.additionalProperties;

    if (jsonSchema.$ref) {
      const reference = jsonSchema.$ref.split('/');
      if (nearAbi.body.root_schema.definitions) {
        properties = (nearAbi.body.root_schema.definitions[reference[2]] as JSONSchema7)
          .properties!;
        additionalProperties = (nearAbi.body.root_schema.definitions[reference[2]] as JSONSchema7)
          .additionalProperties;
      }
    }
    if (properties !== undefined) {
      const object: AbiInput[] = Object.keys(properties).map((name: string) => {
        const types = parseInputTypes(properties[name] as JSONSchema7);
        let components: AbiInput[] | undefined;
        if (types.type.includes('object')) {
          components = parseObject(properties[name] as JSONSchema7);
        }
        return {
          name: name,
          type: types.type,
          internalType: types.internalType,
          components: components ? components : undefined,
        };
      });
      return object;
    } else if (additionalProperties !== undefined) {
      const types = parseInputTypes(additionalProperties as JSONSchema7);
      let components: AbiInput[] | undefined;
      if (types.type.includes('object')) {
        components = parseObject(additionalProperties as JSONSchema7);
      }
      return [
        {
          name: '',
          type: types.type,
          internalType: types.internalType,
          components: components ? components : undefined,
        },
      ];
    }
  };

  const parseArray = (jsonSchema: JSONSchema7) => {
    let items: JSONSchema7Definition | JSONSchema7Definition[] | undefined;
    items = jsonSchema.items;
    if (jsonSchema.$ref) {
      const reference = jsonSchema.$ref.split('/');
      if (nearAbi.body.root_schema.definitions) {
        items = (nearAbi.body.root_schema.definitions[reference[2]] as JSONSchema7).items;
      }
    }
    if (items !== undefined) {
      if (Array.isArray(items)) {
        let internalType: string[] = [];
        items.forEach((item) => {
          const itemType = parseInputTypes(item as JSONSchema7).internalType;
          internalType.push(itemType);
        });
        return '[' + internalType.join(', ') + ']';
      } else {
        const internalType = parseInputTypes(items as JSONSchema7).internalType;
        return internalType + '[]';
      }
    }
  };

  const parseInput = (fn: abi.AbiFunction) => {
    if (fn.params?.serialization_type === 'json') {
      return fn.params?.args.map((param: abi.AbiJsonParameter) => {
        const types = parseInputTypes(param.type_schema);
        let internalType = types.internalType;
        let components: AbiInput[] | undefined;

        if (types.type.includes('object')) {
          components = parseObject(param.type_schema);
        } else if (types.type.includes('array')) {
          const arrayType = parseArray(param.type_schema);
          internalType = arrayType ? arrayType : internalType;
        }

        return {
          name: param.name,
          type: types.type,
          internalType: internalType,
          components: components,
        };
      });
    } else if (fn.params?.serialization_type === 'borsh') {
      return fn.params?.args.map((param: abi.AbiJsonParameter) => {
        return {
          name: param.name,
          type: 'borsh',
          internalType: 'borsh',
        };
      });
    }
    return [];
  };

  /** parse output */
  const parseOutput = (fn: abi.AbiFunction) => {
    // in case return multiple values
    if (fn.result?.type_schema.type === 'array') {
      try {
        return fn.result?.type_schema.items.map((item: JSONSchema7) => {
          const type = parseOutputType(item);
          return {
            name: '',
            type: type ? type : '',
            internalType: item.format ? item.format : type,
          };
        });
      } catch (e) {
        const type = parseOutputType(fn.result.type_schema.items);
        return [
          {
            name: '',
            type: type ? type : '',
            internalType: fn.result?.type_schema.format ? fn.result.type_schema.format : type,
          },
        ];
      }
    } else if (fn.result?.type_schema) {
      const type = parseOutputType(fn.result?.type_schema);
      return [
        {
          name: '',
          type: type ? type : '',
          internalType: fn.result?.type_schema.format ? fn.result.type_schema.format : type,
        },
      ];
    }
  };

  /** Parse AbiItem[] from AbiFunction[] */
  const abis: AbiItem[] = nearAbi.body.functions
    .filter((fn) => {
      // show only public functions
      if (fn.modifiers?.includes('private' as abi.AbiFunctionModifier)) {
        return false;
      }
      return true;
    })
    .map((fn: abi.AbiFunction) => {
      const inputs = parseInput(fn);
      const outputs: AbiOutput[] = parseOutput(fn);
      return {
        type: fn.modifiers?.includes('init' as abi.AbiFunctionModifier)
          ? 'constructor'
          : 'function',
        name: fn.name,
        stateMutability:
          fn.kind === 'view'
            ? 'view'
            : fn.modifiers?.includes('payable' as abi.AbiFunctionModifier)
            ? 'payable'
            : 'nonpayable',
        inputs: inputs,
        outputs: outputs,
      };
    });

  const contract: InterfaceContract = {
    name: nearAbi.metadata?.name ? nearAbi.metadata.name : '',
    address: address,
    abi: abis,
  };

  return contract;
};
