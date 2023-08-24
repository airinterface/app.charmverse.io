import { customRenderWithContext } from 'testing/customRender';

import { CommentForm } from '../CommentForm';

jest.mock('hooks/useFirebaseAuth', () => ({
  useFirebaseAuth: {}
}));

jest.mock('components/proposals/components/SnapshotVoting/hooks/useSnapshotVoting', () => ({}));
jest.mock('components/settings/account/hooks/useLensProfile', () => ({}));

jest.mock('@lit-protocol/lit-node-client', () => ({
  humanizeAccessControlConditions: () => {}
}));

jest.mock('@uauth/js', () => ({
  UAuth: () => {}
}));

jest.mock('lib/snapshot/getProposal', () => ({
  getSnapshotProposal: () => ({ proposals: [] })
}));

jest.mock('lib/snapshot/getSpace', () => ({
  getSnapshotSpace: () => ({ space: {} })
}));

jest.mock('lib/snapshot/getVotes', () => ({
  getSnapshotVotes: () => ({ votes: {} })
}));

jest.mock('lib/snapshot/getVotingPower', () => ({
  getSnapshotVotes: () => ({})
}));

jest.mock('next/router', () => ({
  useRouter: () => ({
    pathname: '/[domain]/',
    query: {
      domain: 'test-space'
    },
    isReady: true
  })
}));

describe('<CommentForm />', () => {
  test('NameConsumer shows value from provider', () => {
    const { container } = customRenderWithContext(<CommentForm handleCreateComment={async () => {}} />, {});
    const placeholder = container.querySelector('[data-placeholder="What are your thoughts?"');
    expect(placeholder).toBeInTheDocument();
  });
});
