import { useEffect } from 'react';
import { Button } from 'react-bootstrap';

interface DeployInEVMProps {
  client: any;
}

const DeployInEVM = ({ client }: DeployInEVMProps) => {
  useEffect(() => {}, []);
  return (
    <>
      <Button className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3">
        Deploy Contract
      </Button>
    </>
  );
};

export default DeployInEVM;
