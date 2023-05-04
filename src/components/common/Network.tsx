import { NetworkProps } from '../../types';

export function NetworkUI(props: NetworkProps) {
  return (
    <div className="" style={{ cursor: 'default' }}>
      <div className="udapp_settingsLabel"></div>
      <div className="udapp_environment" data-id="settingsNetworkEnv">
        <span className="udapp_network badge badge-secondary">{props.networkName}</span>
      </div>
    </div>
  );
}
