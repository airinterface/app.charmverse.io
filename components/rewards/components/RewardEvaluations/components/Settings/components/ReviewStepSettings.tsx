import { Box, Stack } from '@mui/material';

import type { SelectOption } from 'components/common/DatabaseEditor/components/properties/UserAndRoleSelect';
import { UserAndRoleSelect } from 'components/common/DatabaseEditor/components/properties/UserAndRoleSelect';
import { FieldLabel } from 'components/common/WorkflowSidebar/components/FieldLabel';
import type { UpdateableRewardFields } from 'lib/rewards/updateRewardSettings';

import type { EvaluationStepSettingsProps } from './EvaluationStepSettings';

export function ReviewStepSettings({
  rewardInput,
  readOnly,
  onChange
}: Pick<EvaluationStepSettingsProps, 'rewardInput' | 'readOnly' | 'onChange'>) {
  function handleOnChangeReviewers(reviewers: SelectOption[]) {
    onChange({
      reviewers: reviewers as UpdateableRewardFields['reviewers']
    });
  }

  return (
    <Stack gap={1.5}>
      <FieldLabel required>Reviewers</FieldLabel>
      <Box display='flex' height='fit-content' flex={1} className='octo-propertyrow'>
        <UserAndRoleSelect
          data-test='reward-reviewer-select'
          emptyPlaceholderContent='Select user or role'
          value={(rewardInput?.reviewers ?? []) as SelectOption[]}
          readOnly={readOnly}
          variant='outlined'
          onChange={handleOnChangeReviewers}
          required
        />
      </Box>
    </Stack>
  );
}
