import { useEffect } from 'react';
import { Button } from 'react-bootstrap';

interface DeployInEVMProps {
  client: any;
}

const DeployInEVM = ({ client }: DeployInEVMProps) => {
  useEffect(() => {
    client.on(
      'solidity',
      'compilationFinished',
      async (compilationDetails: {
        // contractMap: { file: string } | Record<string, any>; typescript error happens update typescript to remove the error
        contractMap: any;
        contractsDetails: Record<string, any>;
        target?: string;
        input?: Record<string, any>;
      }) => {
        const res = await client.solidity.getCompilationResult();
        console.log(res.data.contracts);
      },
    );
    return () => {
      client.off();
    };
  }, []);
  return (
    <>
      <Button></Button>
    </>
  );
};

export default DeployInEVM;
