import { countPosts } from "./post-repository.shared";
import { PostContentRepository } from "./post-repository.content";
import { PostAdminRepository } from "./post-repository.admin";

export type {
  CreatePostData,
  UpdatePostData,
  ListPostsParams,
  AdminListBlogsParams,
  AdminBlogListItem,
  AdminBlogDetail,
  SitemapPostItem,
} from "./post-repository.types";

export class PostRepository extends PostContentRepository {
  private readonly admin = new PostAdminRepository();

  listCategories = this.admin.listCategories.bind(this.admin);
  createCategory = this.admin.createCategory.bind(this.admin);
  updateCategory = this.admin.updateCategory.bind(this.admin);
  deleteCategory = this.admin.deleteCategory.bind(this.admin);
  getNextCategorySortOrder = this.admin.getNextCategorySortOrder.bind(this.admin);
  reorderCategories = this.admin.reorderCategories.bind(this.admin);
  listFriendLinks = this.admin.listFriendLinks.bind(this.admin);
  createFriendLink = this.admin.createFriendLink.bind(this.admin);
  updateFriendLink = this.admin.updateFriendLink.bind(this.admin);
  deleteFriendLink = this.admin.deleteFriendLink.bind(this.admin);
  listTagStats = this.admin.listTagStats.bind(this.admin);
  getSiteStats = this.admin.getSiteStats.bind(this.admin);
  recordSiteVisit = this.admin.recordSiteVisit.bind(this.admin);
  listAdminBlogs = this.admin.listAdminBlogs.bind(this.admin);
  getAdminBlogDetail = this.admin.getAdminBlogDetail.bind(this.admin);
  updateById = this.admin.updateById.bind(this.admin);
  bulkUpdateStatusByIds = this.admin.bulkUpdateStatusByIds.bind(this.admin);
  bulkDeleteByIds = this.admin.bulkDeleteByIds.bind(this.admin);
  softDeleteById = this.admin.softDeleteById.bind(this.admin);
  restoreById = this.admin.restoreById.bind(this.admin);
  hardDeleteById = this.admin.hardDeleteById.bind(this.admin);
  deleteByAuthor = this.admin.deleteByAuthor.bind(this.admin);
  deleteLikesByUsername = this.admin.deleteLikesByUsername.bind(this.admin);
  deleteDislikesByUsername = this.admin.deleteDislikesByUsername.bind(this.admin);
  deleteFavoritesByUsername = this.admin.deleteFavoritesByUsername.bind(this.admin);
  countAll = this.admin.countAll.bind(this.admin);
  countByStatus = this.admin.countByStatus.bind(this.admin);
  listAdminCategories = this.admin.listAdminCategories.bind(this.admin);

  async getPostCountByAuthor(author: string): Promise<number> {
    return await countPosts("author = ? AND status != 'deleted'", [author]);
  }
}

export const postRepository = new PostRepository();
