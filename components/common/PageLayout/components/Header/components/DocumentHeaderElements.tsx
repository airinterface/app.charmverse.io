import type { PageType } from '@charmverse/core/prisma';

import { documentTypes } from 'components/common/PageActions/components/DocumentPageActionList';

import { DocumentParticipants } from './DocumentParticipants';
import EditingModeToggle from './EditingModeToggle';
import { ShareButton } from './ShareButton/ShareButton';

type Props = {
  headerHeight: number;
  page: {
    deletedAt?: string | Date | null;
    id: string;
    type: string;
  };
};

export function DocumentHeaderElements({ headerHeight, page }: Props) {
  const { deletedAt, id, type } = page;
  const isBasePageDocument = documentTypes.includes(type as PageType);
  return (
    <>
      {isBasePageDocument && <DocumentParticipants />}
      {isBasePageDocument && <EditingModeToggle />}
      {!deletedAt && <ShareButton headerHeight={headerHeight} pageId={id} />}
    </>
  );
}