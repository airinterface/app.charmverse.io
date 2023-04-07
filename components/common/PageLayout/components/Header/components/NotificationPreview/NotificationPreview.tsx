import CloseIcon from '@mui/icons-material/Close';
import CommentIcon from '@mui/icons-material/Comment';
import ForumIcon from '@mui/icons-material/Forum';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import KeyIcon from '@mui/icons-material/Key';
import BountyIcon from '@mui/icons-material/RequestPageOutlined';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import { Box, IconButton, Typography } from '@mui/material';
import { useMemo } from 'react';

import Avatar from 'components/common/Avatar';
import Link from 'components/common/Link';
import type {
  MarkNotificationAsRead,
  NotificationDetails
} from 'components/common/PageLayout/components/Header/components/NotificationPreview/useNotificationPreview';
import type { NotificationGroupType } from 'lib/notifications/interfaces';

type Props = {
  notification: NotificationDetails;
  markAsRead: MarkNotificationAsRead;
  onClose: VoidFunction;
};
export function NotificationPreview({ notification, markAsRead, onClose }: Props) {
  const { groupType, type, spaceName, createdBy, taskId, href, content, title } = notification;

  const icon = useMemo(() => getIcon(groupType), [groupType]);

  return (
    <Link
      color='inherit'
      href={href}
      onClick={() => {
        markAsRead({ taskId, groupType, type });
        onClose();
      }}
    >
      <Box
        sx={{
          '&:hover': {
            cursor: 'pointer',
            background: (theme) => theme.palette.background.light
          }
        }}
        display='flex'
        alignItems='center'
        justifyContent='space-between'
        gap={2}
        pl={2}
        pr={0.5}
        py={1.5}
      >
        <Box display='flex' justifyContent='space-between' width='100%'>
          <Box display='flex' alignItems='flex-start' mr={1.25} pt={0.5}>
            {createdBy ? <Avatar size='small' name={createdBy?.username} avatar={createdBy?.avatar} /> : icon}
          </Box>

          <Box overflow='hidden' display='flex' flexDirection='column' flex={1}>
            <Box display='flex' pl={0.2}>
              <Box minWidth={0}>
                <Typography
                  whiteSpace='nowrap'
                  overflow='hidden'
                  textOverflow='ellipsis'
                  variant='subtitle2'
                >{`${spaceName}`}</Typography>
              </Box>
              &nbsp;
              <Box whiteSpace='nowrap'>
                <Typography variant='subtitle2' fontWeight='bold'>
                  {title}
                </Typography>
              </Box>
            </Box>

            <Typography
              variant='subtitle1'
              sx={{
                display: '-webkit-box',
                overflow: 'hidden',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2
              }}
            >
              {content}
            </Typography>
          </Box>
          <Box display='flex' alignItems='flex-start' ml={0.5} mt={-0.25}>
            <IconButton
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markAsRead({ taskId, groupType, type });
              }}
              size='small'
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Link>
  );
}

function getIcon(groupType: NotificationGroupType) {
  switch (groupType) {
    case 'bounties':
      return <BountyIcon fontSize='small' />;
    case 'votes':
      return <HowToVoteIcon fontSize='small' />;
    case 'forum':
      return <CommentIcon fontSize='small' />;
    case 'proposals':
      return <TaskOutlinedIcon fontSize='small' />;
    case 'discussions':
      return <ForumIcon fontSize='small' />;
    default:
      return <KeyIcon fontSize='small' />;
  }
}