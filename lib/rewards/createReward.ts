import type { BountyPermissionLevel, Page, Prisma } from '@charmverse/core/prisma';
import { prisma } from '@charmverse/core/prisma-client';
import { v4 } from 'uuid';

import { NotFoundError } from 'lib/middleware';
import { generatePagePathFromPathAndTitle } from 'lib/pages/utils';
import { InvalidInputError } from 'lib/utils/errors';

import { getRewardOrThrow } from './getReward';
import { getRewardErrors } from './getRewardErrors';
import { getRewardType } from './getRewardType';
import type { UpdateableRewardFields } from './updateRewardSettings';

export type RewardPageProps = Partial<
  Pick<
    Page,
    'title' | 'content' | 'contentText' | 'sourceTemplateId' | 'headerImage' | 'icon' | 'type' | 'autoGenerated'
  >
>;

export type RewardCreationData = UpdateableRewardFields & {
  linkedPageId?: string;
  spaceId: string;
  userId: string;
  pageProps?: RewardPageProps;
  proposalId?: string | null;
  githubIssueUrl?: string;
  isDraft?: boolean;
};
/**
 * You can create a reward suggestion using only title, spaceId and createdBy. You will see many unit tests using this limited dataset, which will then default the reward to suggestion status. Your logic should account for this.
 */
export async function createReward({
  spaceId,
  userId,
  chainId = 1,
  linkedPageId,
  approveSubmitters = false,
  maxSubmissions,
  rewardAmount,
  rewardToken,
  rewardType,
  customReward = null,
  allowedSubmitterRoles,
  assignedSubmitters,
  dueDate,
  fields,
  reviewers,
  pageProps,
  selectedCredentialTemplates,
  allowMultipleApplications,
  proposalId,
  githubIssueUrl,
  isDraft
}: RewardCreationData) {
  const errors = getRewardErrors({
    page: pageProps || null,
    linkedPageId,
    reward: { assignedSubmitters, rewardAmount, rewardToken, chainId, customReward, reviewers },
    rewardType: rewardType || getRewardType({ rewardAmount, rewardToken, chainId, customReward })
  });
  if (!isDraft && errors.length > 0) {
    throw new InvalidInputError(errors.join(', '));
  }

  const space = await prisma.space.findUnique({
    where: {
      id: spaceId
    },
    select: {
      id: true,
      publicBountyBoard: true
    }
  });

  if (!space) {
    throw new NotFoundError(`Space with id ${spaceId} not found`);
  }

  const rewardId = v4();

  const isAssignedReward = Array.isArray(assignedSubmitters) && assignedSubmitters.length > 0;

  const rewardCreateInput: Prisma.BountyCreateInput = {
    id: rewardId,
    space: {
      connect: {
        id: spaceId
      }
    },
    author: {
      connect: {
        id: userId
      }
    },
    status: isDraft ? 'draft' : 'open',
    githubIssueUrl,
    dueDate,
    fields: fields as any,
    chainId,
    approveSubmitters: isAssignedReward ? false : approveSubmitters,
    maxSubmissions: isAssignedReward ? 1 : maxSubmissions,
    rewardAmount,
    rewardToken,
    rewardType,
    customReward,
    selectedCredentialTemplates,
    allowMultipleApplications: isAssignedReward ? false : allowMultipleApplications,
    proposal: proposalId
      ? {
          connect: {
            id: proposalId
          }
        }
      : undefined
  };

  const rewardPermissions: Prisma.BountyPermissionCreateManyBountyInput[] = [];

  // assign submitter roles only if reward is not assigned
  if (isAssignedReward) {
    assignedSubmitters?.forEach((submitterUserId) =>
      rewardPermissions.push({
        permissionLevel: 'submitter',
        userId: submitterUserId
      })
    );
  } else {
    allowedSubmitterRoles?.forEach((roleId) =>
      rewardPermissions.push({
        permissionLevel: 'submitter',
        roleId
      })
    );
  }

  reviewers?.forEach((reviewer) => {
    const permissionLevel: BountyPermissionLevel = 'reviewer';
    if (reviewer.group === 'role') {
      rewardPermissions.push({
        permissionLevel,
        roleId: reviewer.id
      });
    } else if (reviewer.group === 'user') {
      rewardPermissions.push({
        permissionLevel,
        userId: reviewer.id
      });
    }
  });

  let createdPageId: string | undefined;

  if (!linkedPageId) {
    const results = await prisma.bounty.create({
      data: {
        ...rewardCreateInput,
        permissions: {
          createMany: {
            data: rewardPermissions
          }
        },
        page: {
          create: {
            permissions: {
              createMany: {
                data: isDraft
                  ? [
                      {
                        permissionLevel: 'full_access',
                        userId
                      }
                    ]
                  : [
                      {
                        permissionLevel: 'view',
                        spaceId
                      },
                      {
                        permissionLevel: 'full_access',
                        userId
                      }
                    ]
              }
            },
            id: rewardId,
            path: generatePagePathFromPathAndTitle({ title: pageProps?.title || '' }),
            space: {
              connect: {
                id: spaceId
              }
            },
            updatedBy: userId,
            author: {
              connect: {
                id: userId
              }
            },
            type: pageProps?.type ?? 'bounty',
            content: pageProps?.content ?? undefined,
            contentText: pageProps?.contentText ?? '',
            headerImage: pageProps?.headerImage,
            sourceTemplateId: pageProps?.sourceTemplateId,
            title: pageProps?.title ?? '',
            icon: pageProps?.icon,
            autoGenerated: pageProps?.autoGenerated ?? false
          }
        }
      },
      include: {
        page: true
      }
    });
    createdPageId = results.page?.id;
  } else {
    await prisma.$transaction([
      prisma.bounty.create({
        data: {
          ...rewardCreateInput
        }
      }),
      prisma.page.update({
        where: {
          id: linkedPageId
        },
        data: {
          bountyId: rewardId
        }
      })
    ]);
  }

  const reward = await getRewardOrThrow({ rewardId });
  return { reward, createdPageId };
}
