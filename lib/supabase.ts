import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cywntdkggaugujrvklaf.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5d250ZGtnZ2F1Z3VqcnZrbGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTUwMDMsImV4cCI6MjA5NTQzMTAwM30.IaK3j57JAKRrwg52A-Pzn8sdwb21IylTIoNzC2vEXdk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
