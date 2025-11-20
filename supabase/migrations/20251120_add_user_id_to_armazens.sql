-- Add user_id column to armazens table to link warehouse users
ALTER TABLE public.armazens
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_armazens_user_id ON public.armazens(user_id);

-- Update RLS policies for armazens to allow warehouse users to see their own data
-- Keep existing policy for all authenticated users to view
-- Add policy for armazem users to update their own warehouse info
CREATE POLICY "Armazéns podem atualizar próprio perfil"
  ON public.armazens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
