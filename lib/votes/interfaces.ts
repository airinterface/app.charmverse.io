import { Page, Space, User, UserVote, Vote, VoteOptions } from '@prisma/client';

export const DEFAULT_THRESHOLD = 50;

export const VOTE_STATUS = ['InProgress', 'Passed', 'Rejected', 'Cancelled'] as const;
export type VoteStatusType = typeof VOTE_STATUS[number];

export interface VoteOptionsDTO {
    name: string,
    threshold?: number
}

export interface VoteDTO extends Omit<Vote, 'id'|'status'|'createdAt'> {
    voteOptions: string[]
}

export interface UpdateVoteDTO {
    status: VoteStatusType
}

export interface UserVoteDTO {
    choice: string,
}
export interface ExtendedVote extends Vote {
    userVotes: (UserVote & {user: Pick<User, 'username' | 'avatar'>})[],
    voteOptions: VoteOptions[]
}

export type VoteTask = Vote & {
  page: Page
  space: Space
}
