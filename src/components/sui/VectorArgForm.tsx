import React, { ChangeEvent, useEffect, useState } from 'react';
import { parseArgVal } from './sui-helper';
import { SuiFunc } from './sui-types';
import { log } from '../../utils/logger';
import { isHexadecimal } from './sui-parser';

interface Props {
  func: SuiFunc;
  typeName: string;
  vectorElType: string;
  parentIdx: number;
  updateParam: (value: any, idx: number, parameterType: string) => void;
}

type Arg = string | Arg[];
type U8VecElParseType = 'string' | 'decimal' | 'hex';
interface U8VecHexParseCtx {
  idx: string;
  hex: string;
}

const VectorArgForm: React.FunctionComponent<Props> = ({
  func,
  typeName,
  vectorElType,
  parentIdx,
  updateParam,
}) => {
  log.info(
    `@@@@@@@@@@@@@  VectorArgForm typeName=${typeName}, vectorElType=${vectorElType}, parentIdx=${parentIdx}`,
  );
  const [u8vecParseType, setU8VecParseType] = useState<U8VecElParseType>('string');
  const [args, setArgs] = useState<any[]>([]);
  const [u8VecHexParseCtxs, setU8VecHexParseCtxs] = useState<U8VecHexParseCtx[]>([]);

  useEffect(() => {
    const parameterBoxes = document.getElementsByClassName('sui-parameter');
    for (let i = 0; i < parameterBoxes.length; i++) {
      (parameterBoxes[i] as any).value = '';
    }
    setArgs([]);
  }, [func]);

  // const [args, setArgs] = useState<Arg[]>([[['a', 'b'], []], [], [['c']]]);
  // const [args, setArgs] = useState<Arg[]>(["a", "b", "c"]);
  const indexMemo: number[] = [];

  const toIndices = (id: string) => {
    if (id.startsWith('vec-arg-input-bool')) {
      // "vec-arg-input-bool-0-true-0"
      return id
        .split('-')
        .filter((str) => str.trim() !== '')
        .filter((str, idx) => idx > 6)
        .map((i) => Number(i));
    }
    return id
      .slice('vec-arg-input-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));
  };

  const counterBoolElementId = (id: string) => {
    if (id.includes('true')) {
      return id.replace('true', 'false');
    } else {
      return id.replace('false', 'true');
    }
  };

  const handleParseType = (event: ChangeEvent<HTMLInputElement>, parentIdx: number) => {
    console.log(event);
    const id = event.target.id;
    console.log(id);
    const els = document.getElementsByClassName(`vec-parse-type-${parentIdx}`);
    console.log(els);
    for (let i = 0; i < els.length; i++) {
      const el: any = els.item(i);
      if (el?.id === id) {
        el.checked = true;
        let type: U8VecElParseType;
        if (id.includes('string')) {
          type = 'string';
        } else if (id.includes('hex')) {
          type = 'hex';
        } else {
          type = 'decimal';
        }
        setU8VecParseType(type);
      } else {
        el.checked = false;
      }
    }
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const depth = wordCount(typeName, 'Vector');
    const id = event.target.id;

    const indices = toIndices(id);
    console.log('handleFormChange u8vecParseType', u8vecParseType);
    console.log('handleFormChange vectorElType', vectorElType);
    console.log('handleFormChange depth', depth);
    console.log('handleFormChange indices', indices);
    console.log('handleFormChange event.target.value', event.target.value);
    const value = event.target.value;
    console.log('!!! value', value, value.length);

    const data = [...args];
    console.log('handleFormChange data', data);
    if (typeName === 'Vector<U8>' && u8vecParseType !== 'decimal') {
      if (u8vecParseType === 'string') {
        const hexCtx = u8VecHexParseCtxs.find((ctx) => ctx.idx === indices.toString());
        if (!hexCtx) {
          u8VecHexParseCtxs.push({
            idx: indices.toString(),
            hex: Buffer.from(value, 'utf8').toString('hex'),
          });
        } else {
          hexCtx.hex = Buffer.from(value, 'utf8').toString('hex');
        }
        setU8VecHexParseCtxs([...u8VecHexParseCtxs]);
        const arr = Array.from(Buffer.from(value, 'utf8'));
        setArgs(arr);
        updateParam(arr, parentIdx, typeName);
        return;
      } else if (u8vecParseType === 'hex') {
        const hexCtx = u8VecHexParseCtxs.find((ctx) => ctx.idx === indices.toString());
        if (!hexCtx) {
          u8VecHexParseCtxs.push({
            idx: indices.toString(),
            hex: value,
          });
        } else {
          hexCtx.hex = value;
        }
        setU8VecHexParseCtxs([...u8VecHexParseCtxs]);

        if (isHexadecimal(value)) {
          const arr = Array.from(Buffer.from(value, 'hex'));
          setArgs(arr);
          updateParam(arr, parentIdx, typeName);
        }
        return;
      }
    }

    if (indices.length === 1) {
      if (id.includes('bool')) {
        const el: any = document.getElementById(counterBoolElementId(id));
        el.checked = !el.checked;
        log.info(`handleFormChange ${vectorElType}`);

        data[indices[0]] = parseArgVal(id.includes('true'), vectorElType);
      } else {
        if (vectorElType === 'U8' && u8vecParseType !== 'decimal') {
          if (u8vecParseType === 'string') {
            const hexCtx = u8VecHexParseCtxs.find((ctx) => ctx.idx === indices.toString());
            if (!hexCtx) {
              u8VecHexParseCtxs.push({
                idx: indices.toString(),
                hex: Buffer.from(value, 'utf8').toString('hex'),
              });
            } else {
              hexCtx.hex = Buffer.from(value, 'utf8').toString('hex');
            }
            setU8VecHexParseCtxs([...u8VecHexParseCtxs]);
            // setTmpHexStr(Buffer.from(value, 'utf8').toString());
            const arr = Array.from(Buffer.from(value, 'utf8'));
            data[indices[0]] = arr.map((a) => parseArgVal(a, vectorElType, u8vecParseType));
            setArgs(data);
            updateParam(data, parentIdx, typeName);
            return;
          } else if (u8vecParseType === 'hex') {
            const hexCtx = u8VecHexParseCtxs.find((ctx) => ctx.idx === indices.toString());
            if (!hexCtx) {
              u8VecHexParseCtxs.push({
                idx: indices.toString(),
                hex: value,
              });
            } else {
              hexCtx.hex = value;
            }
            setU8VecHexParseCtxs([...u8VecHexParseCtxs]);
            console.log(`handleFormChange hex u8VecHexParseCtxs`, u8VecHexParseCtxs);
            if (isHexadecimal(value)) {
              const arr = Array.from(Buffer.from(value, 'hex'));
              console.log(`handleFormChange hex arr`, arr);

              data[indices[0]] = arr.map((a) => parseArgVal(a, vectorElType, u8vecParseType));
            }
          }
        } else if (value === '') {
          data[indices[0]] = '';
        } else {
          log.info(`@@@ handleFormChange typeName=${typeName}`);
          data[indices[0]] = parseArgVal(event.target.value, vectorElType, u8vecParseType);
        }
      }

      setArgs(data);
      updateParam(data, parentIdx, typeName);
      return;
    }

    let el: any;
    for (let i = 0; i < indices.length - 1; i++) {
      const idx = indices[i];
      if (!el) {
        el = data[idx];
      } else if (Array.isArray(el)) {
        el = el[idx];
      }
    }

    if (event.target.value === '') {
      el[indices[indices.length - 1]] = '';
    } else {
      console.log(el);
      el[indices[indices.length - 1]] = parseArgVal(
        event.target.value,
        vectorElType,
        u8vecParseType,
      );
    }
    setArgs([...data]);
    updateParam(data, parentIdx, typeName);
  };

  function wordCount(str: string, word: string): number {
    let depth = 0;
    let curIdx = -1;
    while (curIdx < str.length) {
      curIdx = str.indexOf(word, curIdx);
      if (curIdx === -1) {
        break;
      }
      depth++;
      curIdx = curIdx + word.length;
    }
    return depth;
  }

  const addRow = (event: any, vectorElType: string) => {
    log.info(`addRow event=${event}, vectorElType=${vectorElType}`);
    const depth = wordCount(typeName, 'Vector');
    const id = event.target.id as string;
    console.log(`id`, id);

    const indices = id
      .slice('vec-arg-add-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));
    console.log('depth', depth);
    console.log('indices', indices);

    const data = [...args];
    console.log(`data_1`, data);
    if (depth === 1) {
      if (vectorElType === 'Bool') {
        data.push(true);
      } else {
        data.push('');
      }
      setArgs([...data]);
      updateParam(data, parentIdx, typeName);
      console.log(`data_2`, data);
      return;
    }

    if (indices.length === 0) {
      data.push([]);
      setArgs([...data]);
      updateParam(data, parentIdx, typeName);
      return;
    }

    let el = data as any[];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      el = el[idx];
    }
    console.log(`el`, el);

    if (indices.length === depth - 1) {
      if (vectorElType === 'Bool') {
        el.push(true);
      } else {
        el.push('');
      }
    } else {
      el.push([]);
    }

    console.log(`data_2`, data);
    setArgs(data);
    updateParam(data, parentIdx, typeName);
  };

  const removeRow = (event: any) => {
    const id = event.target.id as string;
    const indices = id
      .slice('vec-arg-remove-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));

    const data = [...args];
    let el;
    if (indices.length === 1) {
      data.splice(indices[0], 1);
      setArgs(data);
      updateParam(data, parentIdx, typeName);
      console.log(`data_2`, data);
      return;
    }

    for (let i = 0; i < indices.length - 1; i++) {
      const idx = indices[i];
      if (!el) {
        el = data[idx];
      } else if (Array.isArray(el)) {
        el = el[idx];
      }
    }
    (el as string[]).splice(indices[indices.length - 1], 1);
    console.log(`data_2`, data);
    setArgs([...data]);
    updateParam(data, parentIdx, typeName);
  };

  const parseElValue = (elVal: any, indexMemo: number[]) => {
    if (typeName === 'Vector<U8>' && u8vecParseType !== 'decimal') {
      return parseU8Vector(elVal, indexMemo);
    }

    if (vectorElType === 'U8' && u8vecParseType !== 'decimal') {
      console.log(`parseElValue elVal`, elVal);
      return parseU8Vector(elVal, indexMemo);
    }

    return elVal;
  };

  const parseU8Vector = (nums: number[], indexMemo: number[]) => {
    console.log(`parseU8Vector nums`, nums);
    console.log(`parseU8Vector u8vecParseType`, u8vecParseType);
    console.log(`parseU8Vector u8VecHexParseCtxs`, u8VecHexParseCtxs);
    const hexStr = u8VecHexParseCtxs.find((ctx) => ctx.idx === indexMemo.toString())?.hex || '';

    if (u8vecParseType === 'string') {
      return Buffer.from(nums).toString('utf8');
    } else if (u8vecParseType === 'hex') {
      if (isHexadecimal(hexStr)) {
        return Buffer.from(nums).toString('hex');
      } else {
        return hexStr;
      }
    }
  };

  function getDiv(v: any, i: number, indexMemo: number[]) {
    console.log('############## 12 #################');

    console.log(`getDiv indexMemo`, indexMemo);
    console.log(`getDiv v`, v);
    if (typeName === 'Vector<U8>') {
      console.log('############## 13 #################');

      return <></>;
    }

    // if (
    //   vectorElType === 'U8' &&
    //   u8vecParseType !== 'decimal' &&
    //   Array.isArray(v) &&
    //   v.length > 0 &&
    //   typeof v[0] === 'number'
    // ) {
    //   console.log('############## 14 #################');
    //
    //   return <></>;
    // }

    if (Array.isArray(v)) {
      if (
        vectorElType === 'U8' &&
        u8vecParseType !== 'decimal' &&
        indexMemo.length === wordCount(typeName, 'Vector') - 1
      ) {
        console.log('############## 8 #################');

        return (
          <input
            key={`vec-arg-input-vec-u8-${indexMemo.toString()}`}
            className={'form-control sui-parameter'}
            // id={`vec-arg-input-${indexMemo.join('-')}-abc`}
            id={`vec-arg-input-${indexMemo.join('-')}`}
            name="val"
            placeholder={vectorElType}
            value={parseElValue(v, indexMemo)}
            autoFocus={true}
            onChange={(event) => handleFormChange(event)}
            style={{
              display: 'inline-block',
            }}
          />
        );
      } else {
        console.log('############## 9 #################');

        return (
          <button
            className="btn btn-info btn-sm"
            key={`button-${i}`}
            id={`vec-arg-add-${indexMemo.join('-')}`}
            onClick={(e: any) => addRow(e, vectorElType)}
            // style={{ backgroundColor: 'lightgrey', border: 'none', outline: 'none' }}
          >
            +
          </button>
        );
      }
    }
    console.log('############## 10 #################');

    return <></>;
    //
    // return (
    //   <>
    //     {Array.isArray(v) &&
    //     typeName !== 'Vector<U8>' &&
    //     u8vecParseType != 'decimal' &&
    //     !(vectorElType === 'U8' && indexMemo.length === wordCount(typeName, 'Vector') - 1) ? (
    //       <button
    //         className="btn btn-info btn-sm"
    //         key={`button-${i}`}
    //         id={`vec-arg-add-${indexMemo.join('-')}`}
    //         onClick={(e: any) => addRow(e, vectorElType)}
    //         // style={{ backgroundColor: 'lightgrey', border: 'none', outline: 'none' }}
    //       >
    //         +
    //       </button>
    //     ) : (
    //       <div>abc</div>
    //     )}
    //   </>
    // );
  }

  const render: (val: any, i: number) => any = (val: any, i: number) => {
    console.log('render', val);
    console.log('############## 1 #################');

    if (typeName === 'Vector<U8>' && u8vecParseType !== 'decimal') {
      return (
        <div>
          <input
            className={'form-control sui-parameter'}
            id={`vec-arg-input-${indexMemo.join('-')}`}
            name="val"
            placeholder={vectorElType}
            value={parseU8Vector(val, indexMemo)}
            onChange={(event) => handleFormChange(event)}
            style={{
              display: 'inline-block',
            }}
          />
          <br></br>
        </div>
      );
    }

    if (
      vectorElType === 'U8' &&
      u8vecParseType !== 'decimal' &&
      Array.isArray(val) &&
      val.length > 0 &&
      typeof val[0] === 'number'
    ) {
      console.log('############## 2 #################');
      // return abc({ indexMemo, vectorElType, parseU8Vector, val, handleFormChange });
      return (
        <input
          className={'form-control sui-parameter'}
          key={`vec-arg-input-vector-u8-${indexMemo.join('-')}`}
          id={`vec-arg-input-${indexMemo.join('-')}`}
          name="val"
          autoFocus={true}
          placeholder={vectorElType}
          value={parseU8Vector(val, indexMemo)}
          onChange={(event) => handleFormChange(event)}
          style={{
            display: 'inline-block',
          }}
        />
      );
    }

    console.log('############## 3 #################');

    if (!Array.isArray(val)) {
      console.log('############## 4 #################');

      if (vectorElType === 'Bool' && val === '') {
        val = true;
      }
      if (vectorElType === 'Bool') {
        console.log('############## 5 #################');

        return (
          <div
            id={`vec-arg-input-bool-${parentIdx}-${i}`}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', height: '1em' }}>
              <input
                className={'sui-parameter'}
                id={`vec-arg-input-bool-${parentIdx}-${i}-true-${indexMemo.join('-')}`}
                type="radio"
                name={`vec-arg-input-bool-${parentIdx}-${i}-true-${indexMemo.join('-')}`}
                placeholder={vectorElType}
                defaultChecked={true}
                onChange={(event) => handleFormChange(event)}
              />
              <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                <label>True</label>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                className={'sui-parameter'}
                id={`vec-arg-input-bool-${parentIdx}-${i}-false-${indexMemo.join('-')}`}
                type="radio"
                name={`vec-arg-input-bool-${parentIdx}-${i}-false-${indexMemo.join('-')}`}
                placeholder={vectorElType}
                onChange={(event) => handleFormChange(event)}
              />
              <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                <label>False</label>
              </div>
            </div>

            <br></br>
          </div>
        );
      }
      console.log('############## 6 #################');

      return (
        <div>
          <input
            className={'form-control sui-parameter'}
            id={`vec-arg-input-${indexMemo.join('-')}`}
            name="val"
            placeholder={vectorElType}
            value={parseElValue(val, indexMemo)}
            onChange={(event) => handleFormChange(event)}
            style={{
              display: 'inline-block',
            }}
          />
          <br></br>
        </div>
      );
    }

    console.log('val', val);
    console.log('############## 7 #################');

    return val.map((v, i) => {
      indexMemo.push(i);
      console.log('indexMemo', indexMemo);
      console.log('v', v);

      const b = (
        <div
          key={`sui-vector-${i}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex' }}>
            {vectorElType === 'U8' && u8vecParseType !== 'decimal' ? (
              false
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '2em' }}>[{i}]</div>
              </div>
            )}

            <div
              key={i}
              style={
                Array.isArray(v)
                  ? {
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.5em',
                      border: '0.1px solid',
                      width: '80%',
                    }
                  : {}
              }
            >
              {render(v, i)}
              {vectorElType === 'U8' &&
              u8vecParseType !== 'decimal' &&
              Array.isArray(v) &&
              v.length > 0 &&
              typeof v[0] === 'number'
                ? false
                : getDiv(v, i, indexMemo)}
            </div>
            {typeName !== 'Vector<U8>' ||
            (typeName === 'Vector<U8>' && u8vecParseType == 'decimal') ? (
              <button
                className="btn btn-info btn-sm"
                id={`vec-arg-remove-${indexMemo.join('-')}`}
                onClick={(e) => removeRow(e)}
              >
                -
              </button>
            ) : (
              false
            )}
          </div>
          <div style={{ height: '0.5em' }}></div>
          {indexMemo.length === 0 && typeName !== 'Vector<U8>' && u8vecParseType != 'decimal' ? (
            <button
              className="btn btn-info btn-sm"
              key={`button-${i}`}
              id={`vec-arg-add-${indexMemo.join('-')}`}
              onClick={(e) => addRow(e, vectorElType)}
              style={{ backgroundColor: 'lightgrey', border: 'none', outline: 'none' }}
            >
              +
            </button>
          ) : (
            <></>
          )}
        </div>
      );
      indexMemo.pop();
      console.log('############## 11 #################');

      return b;
    });
  };

  const renderWrapper = () => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!! renderWrapper args', args);
    if (args.length === 0) {
      if (typeName !== 'Vector<U8>' && u8vecParseType != 'decimal') {
        return (
          <button
            className="btn btn-info btn-sm"
            key={`button-${0}`}
            id={`add-btn-${0}`}
            onClick={(e) => addRow(e, vectorElType)}
          >
            +
          </button>
        );
      }
    }

    return (
      <div>
        {render(args, -1)}
        {typeName !== 'Vector<U8>' || (typeName === 'Vector<U8>' && u8vecParseType == 'decimal') ? (
          <button
            className="btn btn-info btn-sm"
            id={`vec-arg-add-${indexMemo.join('-')}`}
            onClick={(e) => addRow(e, vectorElType)}
          >
            +
          </button>
        ) : (
          false
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex' }}>
        <div>{typeName}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '1em' }}>
          <div style={{ display: 'flex', alignItems: 'center', height: '1em' }}>
            <input
              className={`vec-parse-type-${parentIdx}`}
              id={`vec-parse-type-${parentIdx}-string-${indexMemo.join('-')}`}
              type="radio"
              name={`vec-parse-type-${parentIdx}-string-${indexMemo.join('-')}`}
              placeholder={vectorElType}
              defaultChecked={true}
              onChange={(event) => handleParseType(event, parentIdx)}
            />
            <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
              <label>String</label>
            </div>
          </div>
          {vectorElType !== '0x1::string::String' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                className={`vec-parse-type-${parentIdx}`}
                id={`vec-parse-type-${parentIdx}-decimal-${indexMemo.join('-')}`}
                type="radio"
                name={`vec-parse-type-${parentIdx}-decimal-${indexMemo.join('-')}`}
                placeholder={vectorElType}
                onChange={(event) => handleParseType(event, parentIdx)}
              />
              <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                <label>Decimal</label>
              </div>
            </div>
          )}
          {vectorElType !== '0x1::string::String' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                className={`vec-parse-type-${parentIdx}`}
                id={`vec-parse-type-${parentIdx}-hex-${indexMemo.join('-')}`}
                type="radio"
                name={`vec-parse-type-${parentIdx}-hex-${indexMemo.join('-')}`}
                placeholder={vectorElType}
                onChange={(event) => handleParseType(event, parentIdx)}
              />
              <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                <label>Hex</label>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ border: '0.1px solid', padding: '0.5em' }}>{renderWrapper()}</div>
    </div>
  );
};

export default VectorArgForm;
