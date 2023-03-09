import React, { ChangeEvent, useState } from 'react';

interface Props {
  typeName: string;
  vectorElType: string;
}

type Arg = string | Arg[];

const VectorArgForm: React.FunctionComponent<Props> = ({ typeName, vectorElType }) => {
  const [args, setArgs] = useState<Arg[]>([[['a', 'b'], []], [], [['c']]]);
  // const [args, setArgs] = useState<Arg[]>(["a", "b", "c"]);
  const indexMemo: number[] = [];
  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const depth = wordCount(typeName, 'vector');
    const id = event.target.id as string;
    console.log(`id`, id);
    const indices = id
      .slice('vec-arg-input-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));
    console.log('depth', depth);
    console.log('indices', indices);

    const data = [...args];
    if (indices.length === 1) {
      data[indices[0]] = event.target.value;
      setArgs(data);
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
    el[indices[indices.length - 1]] = event.target.value;
    setArgs([...data]);
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

  const addRow = (event: any) => {
    const depth = wordCount(typeName, 'vector');
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
      data.push('');
      setArgs([...data]);
      return;
    }

    if (indices.length === 0) {
      data.push([]);
      setArgs([...data]);
      return;
    }

    let el = data as any[];
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      el = el[idx];
    }
    console.log(`el`, el);

    if (indices.length === depth - 1) {
      el.push('');
    } else {
      el.push([]);
    }

    console.log(`data_2`, data);
    setArgs(data);
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
    setArgs([...data]);
  };

  const render: (val: any, i: number) => any = (val: any, i: number) => {
    if (!Array.isArray(val)) {
      return (
        <div>
          <input
            id={`vec-arg-input-${indexMemo.join('-')}`}
            name="val"
            placeholder={vectorElType}
            value={val}
            onChange={(event) => handleFormChange(event)}
          />
          <br></br>
        </div>
      );
    }

    return val.map((v, i) => {
      indexMemo.push(i);
      // console.log(indexMemo);
      const b = (
        <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: '2em' }}>[{i}]</div>
            <div
              key={i}
              style={
                Array.isArray(v)
                  ? {
                      display: 'flex',
                      flexDirection: 'column',
                      border: '1px solid',
                      padding: '0.5em',
                    }
                  : {}
              }
            >
              {render(v, i)}
              {Array.isArray(v) ? (
                <button
                  key={`button-${i}`}
                  id={`vec-arg-add-${indexMemo.join('-')}`}
                  onClick={addRow}
                  style={{ width: '2em' }}
                >
                  +
                </button>
              ) : (
                <></>
              )}
            </div>
            <button id={`vec-arg-remove-${indexMemo.join('-')}`} onClick={(e) => removeRow(e)}>
              -
            </button>
          </div>
          {Array.isArray(v) ? (
            <div style={{ height: '0.5em', backgroundColor: 'white' }}></div>
          ) : (
            <></>
          )}
          {indexMemo.length === 0 ? (
            <button
              key={`button-${i}`}
              id={`vec-arg-add-${indexMemo.join('-')}`}
              onClick={addRow}
              style={{ width: '2em' }}
            >
              +
            </button>
          ) : (
            <></>
          )}
        </div>
      );
      indexMemo.pop();
      return b;
    });
  };

  return (
    <div>
      <div>{typeName}</div>
      <div style={{ border: '2px solid', padding: '0.5em' }}>
        {args.length === 0 ? (
          <button key={`button-${0}`} id={`add-btn-${0}`} onClick={addRow} style={{ width: '2em' }}>
            +
          </button>
        ) : (
          <div>
            {render(args, -1)}
            <button
              id={`vec-arg-add-${indexMemo.join('-')}`}
              onClick={addRow}
              style={{ width: '2em' }}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VectorArgForm;
