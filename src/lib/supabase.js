import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qoudntstgtwnrwysgsfh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdWRudHN0Z3R3bnJ3eXNnc2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyOTgwMTAsImV4cCI6MjA2Mzg3NDAxMH0.c8tb93KAIi7g6hc8KdB_0V_iGH3S4UACW9CjO0X4htc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);