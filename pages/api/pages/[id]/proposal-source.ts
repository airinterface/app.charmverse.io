import type { PageMeta } from '@charmverse/core/pages';
import { prisma } from '@charmverse/core/prisma-client';
import type { NextApiRequest, NextApiResponse } from 'next';
import nc from 'next-connect';

import { ActionNotPermittedError, NotFoundError, onError, onNoMatch, requireKeys, requireUser } from 'lib/middleware';
import { createCardsFromProposals } from 'lib/pages/createCardsFromProposals';
import { updateCardsFromProposals } from 'lib/pages/updateCardsFromProposals';
import { computePagePermissions } from 'lib/permissions/pages/computePagePermissions';
import { withSessionRoute } from 'lib/session/withSession';

const handler = nc<NextApiRequest, NextApiResponse>({ onError, onNoMatch });

handler
  .use(requireUser)
  .use(requireKeys(['id'], 'query'))
  .post(createProposalSource)
  .put(updateProposalSource);

async function createProposalSource(req: NextApiRequest, res: NextApiResponse<PageMeta[]>) {
  const pageId = req.query.id as string;
  const userId = req.session.user.id;

  const boardPage = await prisma.page.findUnique({
    where: {
      id: pageId
    }
  });

  if (!boardPage?.boardId) {
    throw new NotFoundError('The board page does not exist');
  }

  const permissions = await computePagePermissions({
    resourceId: pageId,
    userId
  });

  if (permissions.edit_content !== true) {
    throw new ActionNotPermittedError('You do not have permission to update this page');
  }

  await createCardsFromProposals({ boardId: pageId, spaceId: boardPage.spaceId, userId });

  return res.status(200).end();
}

async function updateProposalSource(req: NextApiRequest, res: NextApiResponse<PageMeta[]>) {
  const pageId = req.query.id as string;
  const userId = req.session.user.id;

  const boardPage = await prisma.page.findUnique({
    where: {
      id: pageId
    }
  });

  if (!boardPage?.boardId) {
    throw new NotFoundError('The board page does not exist');
  }

  const permissions = await computePagePermissions({
    resourceId: pageId,
    userId
  });

  if (permissions.edit_content !== true) {
    throw new ActionNotPermittedError('You do not have permission to update this page');
  }

  await updateCardsFromProposals({ boardId: pageId, spaceId: boardPage.spaceId, userId });

  return res.status(200).end();
}

export default withSessionRoute(handler);