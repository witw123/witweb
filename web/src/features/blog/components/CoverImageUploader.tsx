/**
 * CoverImageUploader - 封面图片上传组件
 *
 * 为发布页和编辑页提供封面图上传、拖拽和预览能力。
 * 组件内部负责上传流程与拖拽态，最终只把图片 URL 回传给外层表单。
 */
"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { uploadImageRequest } from "@/lib/upload-image-client";
import { resizeImageFile } from "@/utils/image";

export interface CoverImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function CoverImageUploader({ value, onChange, disabled, className }: CoverImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        // 封面图在上传前先压缩，避免大图直接进入文章列表和详情页首屏。
        const resized = await resizeImageFile(file, 1200);
        const formData = new FormData();
        formData.append("file", resized);
        const imageUrl = await uploadImageRequest({
          formData,
          source: "blog.cover-image",
          context: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          },
        });
        onChange(imageUrl);
      } catch (error) {
        console.error("Cover image upload failed:", error);
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        void uploadImage(file);
      }
    },
    [uploadImage]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void uploadImage(file);
      e.currentTarget.value = "";
    },
    [uploadImage]
  );

  const handleRemove = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {value ? (
        <div className="relative group aspect-[21/9] rounded-xl overflow-hidden border border-zinc-800">
          <Image
            src={value}
            alt="Cover image"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 800px"
          />
          <div className="absolute inset-0 flex items-end justify-end p-3 pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || uploading}
                className="px-3 py-1.5 text-xs font-medium bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg transition-colors border border-white/10"
              >
                {uploading ? "上传中..." : "更换封面"}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/80 hover:bg-red-500 backdrop-blur-sm text-white rounded-lg transition-colors border border-red-500/20"
              >
                移除
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "aspect-[21/9] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer",
            isDragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <svg
            className="w-8 h-8 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-zinc-500">
            {uploading ? "上传中..." : "点击或拖拽上传封面图"}
          </p>
          <p className="text-xs text-zinc-600">建议尺寸: 1200x500, 支持 JPG/PNG</p>
        </div>
      )}
    </div>
  );
}

export default CoverImageUploader;
