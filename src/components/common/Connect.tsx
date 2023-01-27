import { Dispatch, useState } from 'react';
import Welldone from '../../assets/dsrv_wallet_icon.png';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { ListGroup, Alert } from 'react-bootstrap';
import AlertCloseButton from '../common/AlertCloseButton';
import Petra from '../../assets/petra.png';

interface InterfaceProps {
  client: Client<Api, Readonly<IRemixApi>>;
  active: boolean;
  setActive: Dispatch<React.SetStateAction<boolean>>;
  chain: string;
  setWallet: Function;
  wallet: string;
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({ client, active, setActive, chain, setWallet, wallet }) => {
  const [error, setError] = useState<string>('');
  return (
    <ListGroup>
      <ListGroup.Item
        as="li"
        action
        active={active && (wallet === 'welldone')}
        onClick={async () => {
          if (!window.dapp) {
            await client.terminal.log({
              value:
                'Please Install WELLDONE Wallet http://abit.ly/install-welldone-wallet . If you have installed it, please press the refresh button.',
              type: 'error',
            });
            setError('Install WELLDONE Wallet');
          } else {
            setActive(true);
            setWallet('welldone')
          }
        }}
      >
        <img src={Welldone} style={{ width: '25px', marginRight: '10px' }} alt="WELLDONE logo" />
        <b>Connect to WELLDONE</b>
      </ListGroup.Item>
      {
        chain === 'aptos' ?
          <ListGroup.Item
            as="li"
            action
            active={active && (wallet === 'petra')}
            onClick={async () => {
              console.log(window)
              if (!((window as any).aptos)) {
                await client.terminal.log({
                  value:
                    'Please Install Petra Wallet https://petra.app/ . If you have installed it, please press the refresh button.',
                  type: 'error',
                });
                setError('Install Petra Wallet');
              } else {
                setActive(true);
                setWallet('petra')
              }
            }}
          >
            <img src={Petra} style={{ width: '25px', marginRight: '10px' }} alt="Petra logo" />
            <b>Connect to Petra</b>
          </ListGroup.Item>
          : false
      }
      <Alert style={{ marginTop: '10px' }} variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <div>{error}</div>
      </Alert>
    </ListGroup>
  );
};
