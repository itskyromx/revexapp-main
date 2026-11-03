-- Bucket configuration only; existing objects are not modified or deleted.
update storage.buckets
set file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif']
where id='media';
