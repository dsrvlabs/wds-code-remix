export default async function wrapPromise(promise: Promise<any>, client: any) {
  let status = 'pending';
  let result: any;
  // await client?.terminal.log('Loading...');

  let suspender = promise.then(
    async (r) => {
      // await client?.terminal.log('Success!');
      status = 'success';
      result = r;
    },
    async (e) => {
      await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
      status = 'error';
      result = e;
    },
  );

  // 컴포넌트 단으로 상태를 전파시킨다면 쓸 코드
  // return {
  //   read() {
  //     switch (status) {
  //       case 'pending':
  //         throw suspender;
  //       case 'error':
  //         throw result;
  //       default:
  //         return result;
  //     }
  //   },
  // };
  return result;
}
