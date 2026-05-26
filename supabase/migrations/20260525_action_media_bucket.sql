-- Create the action-media storage bucket (public read, authenticated upload)
insert into storage.buckets (id, name, public)
values ('action-media', 'action-media', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload files to their own folder
create policy "Users can upload action media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'action-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update/overwrite their own files
create policy "Users can update own action media"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'action-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
create policy "Users can delete own action media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'action-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access (bucket is public, but explicit policy for clarity)
create policy "Anyone can read action media"
  on storage.objects for select
  to public
  using (bucket_id = 'action-media');
