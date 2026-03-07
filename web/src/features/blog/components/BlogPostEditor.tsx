"use client";

import type { Category } from "@/types";

type BlogPostEditorProps = {
  categories: Category[];
  editTitle: string;
  editCategoryId: string;
  editTags: string;
  editContent: string;
  editStatus: string;
  imageWidth: string;
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onImageWidthChange: (value: string) => void;
  onImageSelect: (file: File | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function BlogPostEditor({
  categories,
  editTitle,
  editCategoryId,
  editTags,
  editContent,
  editStatus,
  imageWidth,
  onTitleChange,
  onCategoryChange,
  onTagsChange,
  onContentChange,
  onImageWidthChange,
  onImageSelect,
  onSave,
  onCancel,
}: BlogPostEditorProps) {
  return (
    <section className="card form">
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">标题</span>
        <input
          className="input"
          value={editTitle}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="标题"
        />
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">分类</span>
        <select
          className="input"
          value={editCategoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">未分类</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">标签</span>
        <input
          className="input"
          value={editTags}
          onChange={(event) => onTagsChange(event.target.value)}
          placeholder="tag1, tag2"
        />
      </label>
      <label>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">内容</span>
          <div className="flex items-center gap-2">
            <input
              className="input"
              style={{
                width: "200px",
                display: "inline-block",
                padding: "4px 8px",
                fontSize: "0.8rem",
              }}
              value={imageWidth}
              onChange={(event) => onImageWidthChange(event.target.value)}
              placeholder="图片宽度..."
            />
            <label className="btn-ghost btn-sm m-0 cursor-pointer">
              上传图片
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  onImageSelect(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <textarea
          className="input"
          rows={10}
          value={editContent}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="写下内容..."
        />
      </label>
      {editStatus && <p className="mb-4 text-accent">{editStatus}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" type="button" onClick={onSave}>
          保存修改
        </button>
        <button className="btn-ghost" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </section>
  );
}
