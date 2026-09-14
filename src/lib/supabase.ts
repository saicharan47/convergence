import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://grjdzqmkgqqwwjyzuyyl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyamR6cW1rZ3Fxd3dqeXp1eXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTQyNjUsImV4cCI6MjEwNDk3MDI2NX0.ns1Ezumd3sJpc8i4pGekn6AZ5NE5BqmlTKHf9lNsmhU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
