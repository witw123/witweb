-- Migration 006: Add excerpt and cover_image_url to posts
-- This migration adds fields for article excerpt and cover image

-- Add excerpt column for article summaries (SEO)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS excerpt TEXT;

-- Add cover_image_url column for article cover images
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Create index for better query performance on new columns if needed
-- (Optional: uncomment if you frequently query by cover_image_url)
-- CREATE INDEX IF NOT EXISTS idx_posts_cover_image_url ON posts(cover_image_url) WHERE cover_image_url IS NOT NULL;
