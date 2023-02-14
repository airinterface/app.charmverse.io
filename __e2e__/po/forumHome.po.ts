// playwright-dev-page.ts
import type { Locator, Page } from '@playwright/test';
import type { PostCategory } from '@prisma/client';

import { baseUrl } from 'config/constants';
import { PostCategoryWithPermissions } from 'lib/permissions/forum/interfaces';

// capture actions on the pages in signup flow
export class ForumHomePage {
  readonly page: Page;

  readonly sidebarForumLink: Locator;

  readonly addCategoryButton: Locator;

  readonly addCategoryInput: Locator;

  readonly confirmNewCategoryButton: Locator;

  readonly categoryPermissionsDialog: Locator;

  readonly spaceCategoryPermissionSelect: Locator;

  readonly closeModalButton: Locator;

  readonly postDialog: Locator;

  readonly postDialogCloseButton: Locator;

  readonly postDialogContextMenu: Locator;

  readonly postDialogDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addCategoryButton = page.locator('data-test=add-category-button');
    this.addCategoryInput = page.locator('data-test=add-category-input >> input');
    this.confirmNewCategoryButton = page.locator('data-test=confirm-new-category-button');
    this.sidebarForumLink = page.locator('data-test=sidebar-link-forum');
    this.categoryPermissionsDialog = page.locator('data-test=category-permissions-dialog');
    this.spaceCategoryPermissionSelect = page.locator('data-test=category-space-permission >> input');
    this.closeModalButton = page.locator('data-test=close-modal');
    this.postDialog = page.locator('data-test=dialog');
    this.postDialogCloseButton = page.locator('data-test=close-dialog');
    this.postDialogContextMenu = page.locator('data-test=page-actions-context-menu');
    this.postDialogDeleteButton = page.locator('data-test=delete-page-from-context');
  }

  async goToForumHome(domain: string) {
    await this.page.goto(`${baseUrl}/${domain}/forum`);
    await this.waitForForumHome(domain);
  }

  async waitForForumHome(domain: string) {
    await this.page.waitForURL(`**/${domain}/forum`);
  }

  // Navigation across forum home page ----------------
  getPostCardLocator(postId: string) {
    return this.page.locator(`data-test=forum-post-card-${postId}`);
  }

  async waitForCategory({ domain, path }: { domain: string; path: string }) {
    await this.page.waitForURL(`**/${domain}/forum/${path}`);
  }

  // Interact with post dialog ----------------
  getOpenPostAsPageLocator() {
    return this.page.locator('data-test=open-post-as-page');
  }

  async isDeletePostButtonDisabled(): Promise<boolean> {
    const button = this.postDialogDeleteButton;
    const classes = await button.getAttribute('class');
    return !!classes?.match('Mui-disabled');
  }

  // Interactions with categories sidebar ----------------
  getCategoryLocator(categoryId: string) {
    return this.page.locator(`data-test=forum-category-${categoryId}`);
  }

  getCategoryContextMenuLocator(categoryId: string) {
    return this.page.locator(`data-test=open-category-context-menu-${categoryId}`);
  }

  getCategoryManagePermissionsLocator(categoryId: string) {
    return this.page.locator(`data-test=open-category-permissions-dialog-${categoryId}`);
  }

  async submitNewCategory(): Promise<PostCategory> {
    this.confirmNewCategoryButton.click();
    const response = await this.page.waitForResponse('**/api/spaces/*/post-categories');

    const parsedResponse = await response.json();

    if (response.status() >= 400) {
      throw parsedResponse;
    }

    return parsedResponse as PostCategory;
  }
}
