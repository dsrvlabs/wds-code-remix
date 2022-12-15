import { Button } from 'react-bootstrap';
import Welldone from '../assets/dsrv_wallet_icon.png';
import { FunctionComponent } from 'react';

export const DocumentationButton: FunctionComponent = () => {
  return (
    <Button
      variant="secondary"
      onClick={() => {
        window.open('https://docs.welldonestudio.io/code');
      }}
      style={{ marginTop: '20px', width: '100%' }}
    >
      <img src={Welldone} style={{ width: '35px', marginRight: '20px' }} alt="Github logo" />
      <b>Documentation</b>
    </Button>
  );
};
