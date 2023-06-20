import { useState } from 'react';
import { WelldoneConnect } from './WelldoneConnect';
import { Project } from './Project';
import { ListGroup } from 'react-bootstrap';

import Welldone from '../../assets/dsrv_wallet_icon.png';

interface InterfaceProps {
    client: any
}

export const Connect: React.FunctionComponent<InterfaceProps> = ({client}) => {
  
  const [ dapp, setDapp ] = useState<any>()
  const [ wallet, setWallet ]= useState('')
  const [ account, setAccount ] = useState('')
  const [ walletRpcProvider, setWalletRpcProvider ] = useState<any>();
  const [ active, setActive ] = useState<boolean>(false)

  return (
    <div>
        <ListGroup>
            <ListGroup.Item as="li" action active={active} onClick={()=>{setWallet('Welldone');setActive(true)}}>
                <img src={Welldone} style={ { 'width': '25px', 'marginRight': '10px'} } alt='WELLDONE logo'/>
                <b>Connect to WELLDONE</b>
            </ListGroup.Item>
            {/* <ListGroup.Item as="li" action active={wallet==='Near'} onClick={()=>{setWallet('Near')}}>
                <img src={Near} style={ { 'width': '25px', 'marginRight': '10px'} } alt='Near logo'/>
                <b>Near Wallet</b>
            </ListGroup.Item> */}
        </ListGroup>
        <hr/>
        <div>
            <WelldoneConnect 
                active={active} 
                account={account} 
                setAccount={setAccount} 
                walletRpcProvider={walletRpcProvider} 
                setWalletRpcProvider={setWalletRpcProvider} 
                setDapp={setDapp}
                client={client}
                setActive={setActive}
            />
            <Project 
                dapp={dapp} 
                wallet={wallet} 
                account={account} 
                client={client}
            />
        </div>
    </div>
  );
}
