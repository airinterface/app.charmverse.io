import type { Space } from '@charmverse/core/prisma-client';
import { yupResolver } from '@hookform/resolvers/yup';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';

import { useUpdateSpace } from 'charmClient/hooks/spaces';
import { Button } from 'components/common/Button';
import FieldLabel from 'components/common/form/FieldLabel';
import { useCurrentSpace } from 'hooks/useCurrentSpace';
import { useIsAdmin } from 'hooks/useIsAdmin';
import { useIsCharmverseSpace } from 'hooks/useIsCharmverseSpace';
import { getSnapshotSpace } from 'lib/snapshot/getSpace';
import { isTruthy } from 'lib/utils/types';

import { ConnectBoto } from './ConnectBoto';
import { ConnectCollabland } from './ConnectCollabland';
import { SnapshotIntegration } from './SnapshotDomain';

const schema = yup.object({
  snapshotDomain: yup
    .string()
    .nullable()
    .min(3, 'Snapshot domain must be at least 3 characters')
    .test('checkDomain', 'Snapshot domain not found', async (domain) => {
      if (domain) {
        const foundSpace = await getSnapshotSpace(domain);
        return isTruthy(foundSpace);
      }
      return true;
    })
});

export type FormValues = yup.InferType<typeof schema>;

export function SpaceIntegrations({ space }: { space: Space }) {
  const isAdmin = useIsAdmin();
  const { refreshCurrentSpace } = useCurrentSpace();
  const { trigger: updateSpace, isMutating: updateSpaceLoading } = useUpdateSpace(space.id);
  const isAllowedSpace = useIsCharmverseSpace();
  const {
    handleSubmit,
    reset,
    control,
    formState: { isDirty, dirtyFields }
  } = useForm<FormValues>({
    defaultValues: {
      snapshotDomain: space.snapshotDomain
    },
    resolver: yupResolver(schema),
    mode: 'onSubmit'
  });

  const onSubmit = async (values: FormValues) => {
    if (!isAdmin || !isDirty) {
      return;
    }

    if (dirtyFields.snapshotDomain) {
      await updateSpace({ snapshotDomain: values.snapshotDomain }, { onSuccess: () => refreshCurrentSpace() });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={3} direction='column'>
        <Grid item>
          <FieldLabel>Snapshot.org domain</FieldLabel>
          <SnapshotIntegration control={control} isAdmin={isAdmin} />
        </Grid>
        <Grid item>
          <FieldLabel>Collab.Land</FieldLabel>
          <ConnectCollabland />
        </Grid>
        <Grid item>
          <FieldLabel>Send events to Discord/Telegram</FieldLabel>
          <ConnectBoto />
        </Grid>
      </Grid>
      {isAdmin && (
        <Box
          sx={{
            py: 1,
            px: { xs: 5, md: 3 },
            position: 'absolute',
            mt: 3,
            bottom: '20px',
            left: 0,
            right: 0,
            marginX: 'auto',
            background: (theme) => theme.palette.background.paper,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            textAlign: 'right'
          }}
        >
          {isDirty && (
            <Button
              disableElevation
              variant='outlined'
              disabled={updateSpaceLoading || !isDirty}
              onClick={reset}
              sx={{ mr: 2 }}
            >
              Cancel
            </Button>
          )}
          <Button disableElevation disabled={updateSpaceLoading || !isDirty} type='submit' loading={updateSpaceLoading}>
            Save
          </Button>
        </Box>
      )}
    </form>
  );
}