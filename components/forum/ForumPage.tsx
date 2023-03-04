import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { PostCategory } from '@prisma/client';
import { debounce } from 'lodash';
import { useRouter } from 'next/router';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import charmClient from 'charmClient';
import { CenteredPageContent } from 'components/common/PageLayout/components/PageContent';
import { usePostDialog } from 'components/forum/components/PostDialog/hooks/usePostDialog';
import { useCurrentSpace } from 'hooks/useCurrentSpace';
import { useForumCategories } from 'hooks/useForumCategories';
import { usePageTitle } from 'hooks/usePageTitle';
import type { PostSortOption } from 'lib/forums/posts/constants';
import { setUrlWithoutRerender } from 'lib/utilities/browser';

import { CategoryMenu } from './components/CategoryMenu';
import { CategorySelect } from './components/CategorySelect';
import { CreateForumPost } from './components/CreateForumPost';
import { PostDialog } from './components/PostDialog';
import { PostSkeleton } from './components/PostList/components/PostSkeleton';
import { ForumPostList } from './components/PostList/PostList';

export function ForumPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const currentSpace = useCurrentSpace();
  const sort = router.query.sort as PostSortOption | undefined;
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const { showPost } = usePostDialog();
  const { categories, isCategoriesLoaded } = useForumCategories();
  const [, setTitle] = usePageTitle();
  const [currentCategory, setCurrentCategory] = useState<PostCategory | null>(null);

  useEffect(() => {
    if (currentCategory?.name) {
      setTitle(currentCategory.name);
    }
  }, [currentCategory?.name]);

  useEffect(() => {
    setCategoryFromPath();
  }, [categories, router.query]);
  function setCategoryFromPath() {
    const categoryPath = router.query.categoryPath as string | undefined;
    const category = !categoryPath
      ? null
      : categories.find((_category) => _category.path === categoryPath || _category.name === categoryPath);
    setCurrentCategory(category ?? null);

    // User tried to navigate to a category they cannot access or does not exist, redirect them to forum home
    if (category === undefined && isCategoriesLoaded && currentSpace) {
      router.push(`/${currentSpace.domain}/forum`);
    } else if (category && currentSpace) {
      charmClient.track.trackAction('main_feed_filtered', {
        categoryName: category.name,
        spaceId: currentSpace.id
      });
    }
  }

  function handleSortUpdate(sortName?: PostSortOption) {
    const pathname = `/${currentSpace?.domain}/forum`;

    if (sortName) {
      router.push({
        pathname,
        query: { sort: sortName }
      });
    } else {
      router.push({
        pathname
      });
    }
  }

  function handleCategoryUpdate(newCategoryId?: string) {
    const pathname = `/${currentSpace?.domain}/forum`;

    const newCategory = newCategoryId ? categories.find((category) => category.id === newCategoryId) : null;

    if (newCategory) {
      router.push({
        pathname: `${pathname}/${newCategory.path ?? newCategory.name}`
      });
    } else {
      router.push({
        pathname
      });
    }
  }

  function showNewPostPopup() {
    setShowNewPostForm(true);
  }

  function hideNewPostPopup() {
    setShowNewPostForm(false);
  }

  useEffect(() => {
    if (typeof router.query.postId === 'string') {
      showPost({
        postId: router.query.postId,
        onClose() {
          setUrlWithoutRerender(router.pathname, { postId: null });
        }
      });
    }
  }, [router.query.postId]);

  useEffect(() => {
    if (currentSpace) {
      charmClient.track.trackAction('main_feed_page_load', {
        spaceId: currentSpace.id
      });
    }
  }, [Boolean(currentSpace)]);

  const debounceSearch = useRef(debounce((e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), 400)).current;

  useEffect(() => {
    return () => {
      debounceSearch.cancel();
    };
  }, [debounceSearch]);

  return (
    <CenteredPageContent style={{ width: 1100 }}>
      <Typography variant='h1' mb={2}>
        {currentCategory ? currentCategory?.name : 'All categories'}
      </Typography>
      {currentCategory?.description && (
        <Typography data-test='current-category-description' variant='body1' mb={2}>
          {currentCategory.description}
        </Typography>
      )}

      <TextField
        variant='outlined'
        placeholder='Search posts'
        onChange={debounceSearch}
        fullWidth
        sx={{ padding: '20px 0' }}
        InputProps={{
          endAdornment: (
            <InputAdornment position='end'>
              <SearchIcon color='secondary' fontSize='small' />
            </InputAdornment>
          )
        }}
      />
      <Box display='flex' gap={4}>
        <Box
          sx={{
            width: {
              xs: '100%',
              md: 640
            }
          }}
        >
          <Box display={{ md: 'none' }}>
            <CategorySelect
              selectedCategoryId={currentCategory?.id}
              selectedSort={sort}
              handleCategory={handleCategoryUpdate}
              handleSort={handleSortUpdate}
            />
          </Box>
          <CreateForumPost onClick={showNewPostPopup} />
          {currentSpace && (
            <PostDialog
              newPostCategory={currentCategory}
              open={showNewPostForm}
              onClose={hideNewPostPopup}
              spaceId={currentSpace.id}
            />
          )}
          {!isCategoriesLoaded ? (
            <PostSkeleton />
          ) : (
            <ForumPostList search={search} categoryId={currentCategory?.id} sort={sort} />
          )}
        </Box>
        <Box flexGrow={1} display={{ xs: 'none', md: 'initial' }}>
          <CategoryMenu
            handleCategory={handleCategoryUpdate}
            handleSort={handleSortUpdate}
            selectedSort={sort}
            selectedCategoryId={currentCategory?.id}
          />
        </Box>
      </Box>
    </CenteredPageContent>
  );
}
