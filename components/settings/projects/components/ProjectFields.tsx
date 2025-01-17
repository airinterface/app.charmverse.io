import { projectFieldProperties } from 'lib/projects/formField';
import type { FieldConfig, ProjectAndMembersFieldConfig } from 'lib/projects/formField';

import { FieldAnswers } from './FormFields/FieldAnswers';
import { FieldsEditor } from './FormFields/FieldsEditor';

export function ProjectFieldAnswers({
  fieldConfig,
  defaultRequired,
  disabled,
  onChange
}: {
  disabled?: boolean;
  fieldConfig?: FieldConfig;
  defaultRequired?: boolean;
  onChange?: (updatedProjectValues: Record<string, any>) => any;
}) {
  return (
    <FieldAnswers
      defaultRequired={defaultRequired}
      disabled={disabled}
      fieldConfig={fieldConfig}
      properties={projectFieldProperties}
      onChange={onChange}
    />
  );
}

export function ProjectFieldsEditor({
  onChange,
  fieldConfig,
  defaultRequired
}: {
  defaultRequired?: boolean;
  onChange?: (value: Omit<ProjectAndMembersFieldConfig, 'members'>) => void;
  fieldConfig: Omit<ProjectAndMembersFieldConfig, 'members'>;
}) {
  return (
    <FieldsEditor
      defaultRequired={defaultRequired}
      properties={projectFieldProperties}
      fieldConfig={fieldConfig}
      onChange={onChange}
    />
  );
}
