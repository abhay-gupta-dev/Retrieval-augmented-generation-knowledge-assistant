export type User = {
  id: string;
  google_id: string | null;
  email: string;
  name: string;
  profile_picture: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
};
