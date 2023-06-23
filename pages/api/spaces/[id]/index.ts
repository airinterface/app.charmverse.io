import type { Space } from '@charmverse/core/prisma';
import { prisma } from '@charmverse/core/prisma-client';
import type { NextApiRequest, NextApiResponse } from 'next';
import nc from 'next-connect';

import { onError, onNoMatch, requireSpaceMembership } from 'lib/middleware';
import { SpaceNotFoundError } from 'lib/public-api';
import { withSessionRoute } from 'lib/session/withSession';
import { updateSpace } from 'lib/spaces/updateSpace';

const handler = nc<NextApiRequest, NextApiResponse>({ onError, onNoMatch });

handler
  .get(requireSpaceMembership({ adminOnly: false, spaceIdKey: 'id' }), getSpace)
  .put(requireSpaceMembership({ adminOnly: true, spaceIdKey: 'id' }), updateSpaceController)
  .delete(requireSpaceMembership({ adminOnly: true, spaceIdKey: 'id' }), deleteSpace);

async function getSpace(req: NextApiRequest, res: NextApiResponse<Space>) {
  const { id: spaceId } = req.query as { id: string };

  const space = await prisma.space.findUnique({
    where: {
      id: spaceId
    }
  });

  if (!space) {
    throw new SpaceNotFoundError(spaceId);
  }

  res.status(200).json(space);
}

async function updateSpaceController(req: NextApiRequest, res: NextApiResponse<Space>) {
  const spaceId = req.query.id as string;

  const updatedSpace = await updateSpace(spaceId, req.body);

  res.status(200).send(updatedSpace);
}

async function deleteSpace(req: NextApiRequest, res: NextApiResponse) {
  await prisma.space.delete({
    where: {
      id: req.query.id as string
    }
  });
  return res.status(200).json({ ok: true });
}

export default withSessionRoute(handler);
