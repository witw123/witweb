/**
 * 博客文章仓储层
 *
 * 聚合文章前台内容查询与后台管理能力，对外暴露统一的文章仓储入口。
 * 这样业务代码无需感知“内容侧”和“管理侧”分别由不同实现承载。
 */

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

/**
 * 博客文章数据访问类
 *
 * 继承前台内容仓储，并通过组合方式接入后台管理仓储。
 * 多数后台方法直接透传绑定，保留单一实例的调用体验。
 */
export class PostRepository extends PostContentRepository {
  private readonly admin = new PostAdminRepository();

  // 管理能力通过显式绑定暴露，避免业务方直接依赖内部 admin 实例。
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

  /**
   * 统计指定作者的有效文章数量
   *
   * 软删除文章不计入总数，用于个人中心和后台概览展示。
   *
   * @param {string} author - 作者用户名
   * @returns {Promise<number>} 作者文章数量
   */
  async getPostCountByAuthor(author: string): Promise<number> {
    return await countPosts("author = ? AND status != 'deleted'", [author]);
  }
}

/** 默认文章仓储实例，供应用层直接复用。 */
export const postRepository = new PostRepository();
