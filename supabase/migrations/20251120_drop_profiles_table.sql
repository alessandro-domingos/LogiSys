-- Final step: Drop the profiles table
-- This should only be run after all data has been migrated to entity tables
-- and all foreign key constraints have been updated

-- Drop the profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Note: The CASCADE will drop any remaining dependencies
-- All FKs should have been updated in previous migrations
