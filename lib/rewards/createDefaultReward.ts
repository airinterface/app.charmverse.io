import { MAX_EMBED_WIDTH } from 'components/common/CharmEditor/components/iframe/config';
import { VIDEO_ASPECT_RATIO } from 'components/common/CharmEditor/components/video/videoSpec';
import { Constants } from 'lib/focalboard/constants';

import {
  REWARDS_APPLICANTS_BLOCK_ID,
  REWARDS_AVAILABLE_BLOCK_ID,
  CREATED_AT_ID,
  DUE_DATE_ID,
  REWARD_REVIEWERS_BLOCK_ID,
  REWARD_AMOUNT,
  REWARD_APPLICANTS_COUNT,
  REWARD_CHAIN,
  REWARD_CUSTOM_VALUE,
  REWARD_STATUS_BLOCK_ID,
  REWARD_TOKEN,
  REWARDER_BLOCK_ID
} from './blocks/constants';
import { createReward } from './createReward';

export async function createDefaultReward({ spaceId, userId }: { spaceId: string; userId: string }) {
  await createReward({
    spaceId,
    userId,
    customReward: 'Custom Reward',
    reviewers: [
      {
        group: 'user',
        id: userId
      }
    ],
    chainId: null,
    rewardAmount: null,
    rewardToken: null,
    fields: {
      properties: {
        [REWARDS_APPLICANTS_BLOCK_ID]: [],
        [REWARDS_AVAILABLE_BLOCK_ID]: '',
        [CREATED_AT_ID]: '',
        [DUE_DATE_ID]: '',
        [REWARD_REVIEWERS_BLOCK_ID]: [
          {
            group: 'user',
            id: userId
          }
        ],
        [REWARD_AMOUNT]: '',
        [REWARD_APPLICANTS_COUNT]: '0',
        [REWARD_CHAIN]: '',
        [REWARD_CUSTOM_VALUE]: 'Custom Reward',
        [REWARD_STATUS_BLOCK_ID]: '',
        [REWARD_TOKEN]: '',
        [REWARDER_BLOCK_ID]: '',
        [Constants.titleColumnId]: 'Default Reward'
      }
    },
    pageProps: {
      type: 'bounty',
      title: 'Default Reward',
      sourceTemplateId: null,
      headerImage: null,
      icon: null,
      contentText: '',
      content: {
        type: 'doc',
        content: [
          {
            type: 'iframe',
            attrs: {
              type: 'embed',
              src: 'https://tiny.charmverse.io/bounties',
              width: MAX_EMBED_WIDTH,
              height: MAX_EMBED_WIDTH / VIDEO_ASPECT_RATIO
            }
          }
        ]
      },
      autoGenerated: true
    }
  });
}