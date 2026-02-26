CREATE POLICY "Admins can update extensions"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'extensions' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'extensions' AND has_role(auth.uid(), 'admin'::app_role));