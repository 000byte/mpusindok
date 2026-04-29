const supabaseUrl = 'https://fvsgrbzwfllilxefazyz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2c2dyYnp3ZmxsaWx4ZWZhenl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzE4ODYsImV4cCI6MjA5MDM0Nzg4Nn0.2bTfAucNBwiWeQTnLGOHo4l-KCcdu03xjfprElmemjE';

// Create a single supabase client for interacting with your database
window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
