-- Photo files stay at or under 400 KB. WebP and JPEG only.

update storage.buckets
set
  file_size_limit = 409600,
  allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'photos';
