import type { TargetPermissionGroup } from '@charmverse/core/permissions';
import styled from '@emotion/styled';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Autocomplete, Box, Chip, IconButton, Stack, TextField, Tooltip } from '@mui/material';
import { useCallback, useMemo, useState } from 'react';

import type { PropertyValueDisplayType } from 'components/common/BoardEditor/interfaces';
import UserDisplay from 'components/common/UserDisplay';
import { useIsFreeSpace } from 'hooks/useIsFreeSpace';
import { useMembers } from 'hooks/useMembers';
import { useRoles } from 'hooks/useRoles';
import type { Member } from 'lib/members/interfaces';
import { isTruthy } from 'lib/utilities/types';
import type { ListSpaceRolesResponse } from 'pages/api/roles';

import { EmptyPlaceholder } from './EmptyPlaceholder';
import { SelectPreviewContainer } from './TagSelect/TagSelect';

export type RoleOption = TargetPermissionGroup<'role'>;
type MemberOption = TargetPermissionGroup<'user'>;
type SystemRoleOption<T extends string = string> = { group: 'system_role'; id: T };
export type SelectOption = RoleOption | MemberOption | SystemRoleOption;
type RoleOptionPopulated = ListSpaceRolesResponse & RoleOption;
type MemberOptionPopulated = Member & MemberOption;
export type SystemRoleOptionPopulated<T extends string = string> = SystemRoleOption<T> & {
  icon: JSX.Element;
  label: string;
};

export type SelectOptionPopulated = RoleOptionPopulated | MemberOptionPopulated | SystemRoleOptionPopulated;

type ContainerProps = {
  displayType?: PropertyValueDisplayType;
};

const StyledAutocomplete = styled(Autocomplete<SelectOptionPopulated, true, boolean>)`
  min-width: 150px;
  .MuiAutocomplete-inputRoot {
    gap: 4px;
  }
`;

export const StyledUserPropertyContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'displayType'
})<ContainerProps>`
  flex-grow: 1;

  ${(props) =>
    props.displayType === 'details'
      ? `
      .MuiInputBase-root {
        padding: 4px 8px;
      }
      `
      : ''}

  // override styles from focalboard
  .MuiInputBase-input {
    background: transparent;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }

  // dont let the input extend over neighbor columns in table mode when it is expanded
  overflow: ${(props) => (props.displayType === 'table' ? 'hidden' : 'initial')};
`;

function SelectedOptions({
  value,
  isRequiredValue = () => false,
  readOnly,
  onRemove,
  wrapColumn,
  errorValues
}: {
  wrapColumn?: boolean;
  readOnly: boolean;
  value: SelectOptionPopulated[];
  isRequiredValue?: (option: SelectOptionPopulated) => boolean;
  onRemove: (reviewerId: string) => void;
  errorValues?: string[];
}) {
  return (
    <>
      {value.map((option) => {
        return (
          <>
            {option.group === 'user' && (
              <Stack
                alignItems='center'
                flexDirection='row'
                key={option.id}
                gap={0.5}
                data-test='selected-user-or-role-option'
                sx={wrapColumn ? { justifyContent: 'space-between', overflowX: 'hidden' } : { overflowX: 'hidden' }}
              >
                <UserDisplay fontSize={14} avatarSize='xSmall' userId={option.id} wrapName={wrapColumn} />
                {!readOnly && !isRequiredValue(option) && (
                  <IconButton size='small' onClick={() => onRemove(option.id)}>
                    <CloseIcon
                      sx={{
                        fontSize: 14
                      }}
                      cursor='pointer'
                      color='secondary'
                    />
                  </IconButton>
                )}
              </Stack>
            )}
            {option.group === 'role' && (
              <Chip
                data-test='selected-user-or-role-option'
                color={errorValues?.includes?.(option.id) ? 'warning' : undefined}
                sx={{ px: 0.5, cursor: readOnly || isRequiredValue(option) ? 'text' : 'pointer' }}
                label={option.name}
                // color={option.color}
                key={option.id}
                size='small'
                onDelete={readOnly || isRequiredValue(option) ? undefined : () => onRemove(option.id)}
                deleteIcon={
                  <CloseIcon
                    sx={{
                      fontSize: 14
                    }}
                    cursor='pointer'
                  />
                }
              />
            )}
            {option.group === 'system_role' && (
              <Chip
                data-test='selected-user-or-role-option'
                color={errorValues?.includes?.(option.id) ? 'warning' : undefined}
                sx={{ px: 0.5, cursor: readOnly || isRequiredValue(option) ? 'text' : 'pointer' }}
                label={option.label}
                key={option.id}
                icon={option.icon}
                variant='outlined'
                size='small'
                onDelete={readOnly || isRequiredValue(option) ? undefined : () => onRemove(option.id)}
                deleteIcon={
                  <CloseIcon
                    sx={{
                      fontSize: 14
                    }}
                    cursor='pointer'
                  />
                }
              />
            )}
          </>
        );
      })}
    </>
  );
}

type Props<T> = {
  emptyPlaceholderContent?: string;
  inputPlaceholder?: string; // placeholder for the editable input of outlined variant
  displayType?: PropertyValueDisplayType;
  onChange: (value: SelectOptionPopulated[]) => void;
  readOnly?: boolean;
  readOnlyMessage?: string;
  showEmptyPlaceholder?: boolean;
  systemRoles?: SystemRoleOptionPopulated[];
  value: T[];
  isRequiredValue?: (value: SelectOptionPopulated) => boolean;
  variant?: 'outlined' | 'standard';
  'data-test'?: string;
  wrapColumn?: boolean;
  type?: 'role' | 'roleAndUser';
  required?: boolean;
  errorValues?: string[];
};

export function UserAndRoleSelect<T extends { id: string; group: string } = SelectOption>({
  displayType = 'details',
  onChange,
  readOnly,
  readOnlyMessage,
  inputPlaceholder,
  showEmptyPlaceholder = true,
  emptyPlaceholderContent = 'Empty',
  systemRoles = [],
  variant = 'standard',
  value: inputValue,
  isRequiredValue,
  'data-test': dataTest,
  wrapColumn,
  type = 'roleAndUser',
  required,
  errorValues
}: Props<T>): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const { roles } = useRoles();
  const { members } = useMembers();
  const { isFreeSpace } = useIsFreeSpace();

  const filteredMembers = members.filter((member) => !member.isBot);
  // For public spaces, we don't want to show reviewer roles
  const applicableValues = isFreeSpace
    ? (inputValue as { id: string; group: 'user' | 'role' }[]).filter((elem) => elem.group === 'user')
    : (inputValue as { id: string; group: 'user' | 'role' }[]);

  const mappedMembers: MemberOptionPopulated[] = filteredMembers.map((member) => ({ ...member, group: 'user' }));
  const mappedRoles: RoleOptionPopulated[] =
    roles?.map((includedRole) => ({ ...includedRole, group: 'role' } as ListSpaceRolesResponse & { group: 'role' })) ??
    [];

  const filteredOptions = useMemo(() => {
    let _filteredOptions: SelectOptionPopulated[] = [];
    if (isFreeSpace) {
      // In public space, don't include custom roles
      _filteredOptions = type === 'role' ? [] : [...mappedMembers, ...systemRoles];
    } else {
      // For bounties, allow any space member or role to be selected
      if (type === 'role') {
        _filteredOptions = [...systemRoles, ...mappedRoles];
      }

      if (type === 'roleAndUser') {
        _filteredOptions = [...mappedMembers, ...systemRoles, ...mappedRoles];
      }
    }
    return _filteredOptions;
  }, [systemRoles, isFreeSpace, filteredMembers, roles, type]);

  const allOptions = useMemo(() => {
    if (isFreeSpace) {
      return [...mappedMembers, ...systemRoles];
    } else {
      return [...mappedMembers, ...mappedRoles, ...systemRoles];
    }
  }, [filteredMembers, roles]);

  const populatedValue = inputValue.map(({ id }) => allOptions.find((opt) => opt.id === id)).filter(isTruthy);

  const onClickToEdit = useCallback(() => {
    if (!readOnly) {
      setIsOpen(true);
    }
  }, [readOnly]);

  function removeOption(idToRemove: string) {
    onChange(populatedValue.filter(({ id }) => id !== idToRemove));
  }

  function getPlaceholderLabel() {
    if (inputPlaceholder) {
      return inputPlaceholder;
    }
    if (isFreeSpace) {
      return 'Search for a person...';
    }

    if (type === 'role') {
      return 'Search for a role...';
    }

    return 'Search for a person or role...';
  }

  // TODO: maybe we don't need a separate component for un-open state?
  if (variant === 'standard' && !isOpen) {
    return (
      <SelectPreviewContainer
        data-test={dataTest}
        isHidden={isOpen}
        displayType={displayType}
        readOnly={readOnly}
        onClick={onClickToEdit}
      >
        <Tooltip title={readOnlyMessage ?? null}>
          <Box display='inline-flex' flexWrap='wrap' gap={0.5}>
            {applicableValues.length === 0 ? (
              showEmptyPlaceholder && <EmptyPlaceholder>{emptyPlaceholderContent}</EmptyPlaceholder>
            ) : (
              <SelectedOptions
                wrapColumn={wrapColumn}
                readOnly
                value={populatedValue}
                onRemove={removeOption}
                errorValues={errorValues}
              />
            )}
          </Box>
        </Tooltip>
      </SelectPreviewContainer>
    );
  }

  return (
    <Tooltip title={readOnlyMessage ?? null}>
      <StyledUserPropertyContainer displayType='details'>
        <StyledAutocomplete
          data-test={dataTest}
          autoHighlight
          disableClearable
          disableCloseOnSelect
          filterSelectedOptions
          forcePopupIcon={false}
          fullWidth
          getOptionLabel={(option) => {
            if (!option) {
              return '';
            }
            if (option.group === 'user') {
              return option.username;
            }
            if (option.group === 'role') {
              return option.name;
            }
            return option.label;
          }}
          groupBy={(option) => {
            const group = option.group === 'system_role' ? 'role' : option.group;
            return `${group[0].toUpperCase() + group.slice(1)}s`;
          }}
          isOptionEqualToValue={(option, val) => option.id === val.id}
          loading={!roles || filteredMembers.length === 0}
          multiple
          noOptionsText='No more options available'
          onChange={(e, value) => onChange(value)}
          onClose={() => setIsOpen(false)}
          openOnFocus
          options={filteredOptions}
          renderInput={(params) => (
            <TextField
              {...params}
              autoFocus={variant === 'standard'}
              size='small'
              value={applicableValues}
              placeholder={populatedValue.length === 0 ? getPlaceholderLabel() : ''}
              // kind of hacky but useful for proposal forms where its hard to see all required fields
              error={required && populatedValue.length === 0}
              InputProps={{
                ...params.InputProps,
                ...(variant === 'standard' && { disableUnderline: true })
              }}
              variant={variant}
            />
          )}
          renderOption={(_props, option) => {
            if (option.group === 'role') {
              return (
                <li data-test={`select-option-${option.id}`} {..._props}>
                  <Chip sx={{ px: 0.5, cursor: readOnly ? 'text' : 'pointer' }} label={option.name} size='small' />
                </li>
              );
            }
            if (option.group === 'system_role') {
              return (
                <li data-test={`select-option-${option.id}`} {..._props}>
                  <Chip
                    sx={{ px: 0.5, cursor: readOnly ? 'text' : 'pointer' }}
                    variant='outlined'
                    icon={option.icon}
                    label={option.label}
                    size='small'
                  />
                </li>
              );
            }
            return (
              <UserDisplay
                data-test={`select-option-${option.id}`}
                {...(_props as any)}
                userId={option.id}
                avatarSize='small'
              />
            );
          }}
          renderTags={() => (
            <SelectedOptions
              wrapColumn={wrapColumn}
              readOnly={!!readOnly}
              value={populatedValue}
              isRequiredValue={isRequiredValue}
              onRemove={removeOption}
              errorValues={errorValues}
            />
          )}
          disabled={!!readOnly}
          value={populatedValue}
        />
      </StyledUserPropertyContainer>
    </Tooltip>
  );
}
