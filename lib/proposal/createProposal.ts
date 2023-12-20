import { InsecureOperationError, InvalidInputError } from '@charmverse/core/errors';
import type { PageWithPermissions } from '@charmverse/core/pages';
import type { Page, ProposalStatus, ProposalReviewer, Vote } from '@charmverse/core/prisma';
import type { Prisma, ProposalEvaluation, ProposalEvaluationType } from '@charmverse/core/prisma-client';
import { prisma } from '@charmverse/core/prisma-client';
import type { ProposalWithUsers, WorkflowEvaluationJson, ProposalWorkflowTyped } from '@charmverse/core/proposals';
import { arrayUtils } from '@charmverse/core/utilities';
import { v4 as uuid } from 'uuid';

import { trackUserAction } from 'lib/metrics/mixpanel/trackUserAction';
import { createPage } from 'lib/pages/server/createPage';
import type { ProposalFields } from 'lib/proposal/blocks/interfaces';
import { WebhookEventNames } from 'lib/webhookPublisher/interfaces';
import { publishProposalEvent } from 'lib/webhookPublisher/publishEvent';

import { getPagePath } from '../pages';

import type { ProposalReviewerInput, VoteSettings } from './interface';
import type { RubricDataInput } from './rubric/upsertRubricCriteria';
import { upsertRubricCriteria } from './rubric/upsertRubricCriteria';
import { validateProposalAuthorsAndReviewers } from './validateProposalAuthorsAndReviewers';

type PageProps = Partial<
  Pick<
    Page,
    'title' | 'content' | 'contentText' | 'sourceTemplateId' | 'headerImage' | 'icon' | 'type' | 'autoGenerated'
  >
>;

export type ProposalEvaluationInput = Pick<ProposalEvaluation, 'id' | 'index' | 'title' | 'type'> & {
  reviewers: Partial<Pick<ProposalReviewer, 'userId' | 'roleId' | 'systemRole'>>[];
  rubricCriteria: RubricDataInput[];
  permissions?: WorkflowEvaluationJson['permissions']; // pass these in to override workflow defaults
  voteSettings?: VoteSettings | null;
};

export type CreateProposalInput = {
  pageId?: string;
  pageProps?: PageProps;
  categoryId: string;
  reviewers?: ProposalReviewerInput[];
  authors?: string[];
  userId: string;
  spaceId: string;
  evaluationType?: ProposalEvaluationType;
  rubricCriteria?: RubricDataInput[];
  evaluations?: ProposalEvaluationInput[];
  publishToLens?: boolean;
  fields?: ProposalFields;
  workflowId?: string;
};

export type CreatedProposal = {
  page: PageWithPermissions;
  proposal: ProposalWithUsers;
};

export async function createProposal({
  userId,
  spaceId,
  categoryId,
  pageProps,
  authors,
  reviewers,
  evaluations = [],
  evaluationType,
  rubricCriteria,
  publishToLens,
  fields,
  workflowId
}: CreateProposalInput) {
  if (!categoryId) {
    throw new InvalidInputError('Proposal must be linked to a category');
  }

  const proposalId = uuid();
  const proposalStatus: ProposalStatus = 'draft';

  const authorsList = arrayUtils.uniqueValues(authors ? [...authors, userId] : [userId]);

  const workflow = workflowId
    ? ((await prisma.proposalWorkflow.findUnique({
        where: {
          id: workflowId
        }
      })) as ProposalWorkflowTyped | null)
    : null;

  const validation = await validateProposalAuthorsAndReviewers({
    authors: authorsList,
    reviewers: reviewers ?? [],
    spaceId
  });

  if (!validation.valid) {
    throw new InsecureOperationError(`You cannot create a proposal with authors or reviewers outside the space`);
  }
  const evaluationIds = evaluations.map(() => uuid());

  const evaluationPermissionsToCreate: Prisma.ProposalEvaluationPermissionCreateManyInput[] = [];

  let reviewersInput =
    reviewers?.map(
      (r) =>
        ({
          // id: r.group !== 'system_role' ? r.id : undefined, // system roles dont have ids
          proposalId,
          roleId: r.group === 'role' ? r.id : undefined,
          systemRole: r.group === 'system_role' ? r.id : undefined,
          userId: r.group === 'user' ? r.id : undefined
        } as Prisma.ProposalReviewerCreateManyInput)
    ) || [];

  // retrieve permissions and apply evaluation ids to reviewers
  if (evaluations.length > 0) {
    evaluations.forEach(({ id: evaluationId, permissions: permissionsInput }, index) => {
      const configuredEvaluation = workflow?.evaluations.find((e) => e.id === evaluationId);
      const permissions = configuredEvaluation?.permissions ?? permissionsInput;
      if (!permissions) {
        throw new Error(
          `Cannot find permissions for evaluation step. Workflow: ${workflowId}. Evaluation: ${evaluationId}`
        );
      }
      evaluationPermissionsToCreate.push(
        ...permissions.map((permission) => ({
          evaluationId: evaluationIds[index],
          operation: permission.operation,
          systemRole: permission.systemRole
        }))
      );
    });

    reviewersInput = evaluations.flatMap((evaluation, index) =>
      evaluation.reviewers.map((reviewer) => ({
        roleId: reviewer.roleId,
        systemRole: reviewer.systemRole,
        userId: reviewer.userId,
        proposalId,
        evaluationId: evaluationIds[index]
      }))
    );
  }

  for (const evaluation of evaluations) {
    if (evaluation.reviewers.length === 0) {
      throw new Error('No reviewers defined for proposal evaluation step');
    }
  }

  // Using a transaction to ensure both the proposal and page gets created together
  const [proposal, , , page] = await prisma.$transaction([
    prisma.proposal.create({
      data: {
        // Add page creator as the proposal's first author
        createdBy: userId,
        id: proposalId,
        space: { connect: { id: spaceId } },
        status: proposalStatus,
        category: { connect: { id: categoryId } },
        evaluationType,
        publishToLens,
        authors: {
          createMany: {
            data: authorsList.map((author) => ({ userId: author }))
          }
        },
        evaluations: {
          createMany: {
            data: evaluations.map((evaluation, index) => ({
              id: evaluationIds[index],
              voteSettings: evaluation.voteSettings || undefined,
              index: evaluation.index,
              title: evaluation.title,
              type: evaluation.type
            }))
          }
        },
        fields,
        workflow: workflowId
          ? {
              connect: {
                id: workflowId
              }
            }
          : undefined
      },
      include: {
        authors: true,
        category: true
      }
    }),
    prisma.proposalReviewer.createMany({
      data: reviewersInput
    }),
    prisma.proposalEvaluationPermission.createMany({
      data: pageProps?.type === 'proposal_template' ? [] : evaluationPermissionsToCreate
    }),
    createPage({
      data: {
        autoGenerated: pageProps?.autoGenerated ?? false,
        content: pageProps?.content ?? undefined,
        createdBy: userId,
        contentText: pageProps?.contentText ?? '',
        headerImage: pageProps?.headerImage,
        icon: pageProps?.icon,
        id: proposalId,
        path: getPagePath(),
        proposalId,
        sourceTemplateId: pageProps?.sourceTemplateId,
        title: pageProps?.title ?? '',
        type: pageProps?.type ?? 'proposal',
        updatedBy: userId,
        spaceId
      }
    })
  ]);

  const createdReviewers = await prisma.proposalReviewer.findMany({
    where: { proposalId: proposal.id }
  });

  trackUserAction('new_proposal_created', { userId, pageId: page.id, resourceId: proposal.id, spaceId });

  const upsertedCriteria = rubricCriteria
    ? await upsertRubricCriteria({
        proposalId: proposal.id,
        evaluationId: null,
        rubricCriteria
      })
    : [];

  await Promise.all(
    evaluations.map(async (evaluation, index) => {
      if (evaluation.rubricCriteria.length > 0) {
        await upsertRubricCriteria({
          evaluationId: evaluationIds[index],
          proposalId: proposal.id,
          rubricCriteria: evaluation.rubricCriteria
        });
      }
    })
  );

  await publishProposalEvent({
    scope: WebhookEventNames.ProposalStatusChanged,
    proposalId: proposal.id,
    newStatus: proposal.status,
    spaceId,
    userId,
    oldStatus: null
  });

  return {
    page: page as PageWithPermissions,
    proposal: {
      ...proposal,
      reviewers: createdReviewers,
      rubricCriteria: upsertedCriteria,
      draftRubricAnswers: [],
      rubricAnswers: []
    }
  };
}
