import { Button } from 'react-bootstrap';
import Github from '../assets/GitHub-Mark-Light-64px.png';

export const MakeAIssueButton: React.FunctionComponent = () => {
  return (
    <Button
      onClick={() => {
        window.open('https://github.com/dsrvlabs/wds-code-remix/issues');
      }}
      style={{ marginTop: '20px', width: '100%' }}
    >
      <img src={Github} style={{ width: '35px', marginRight: '20px' }} alt="Github logo" />
      <b>Make an issue</b>
    </Button>
  );
};
