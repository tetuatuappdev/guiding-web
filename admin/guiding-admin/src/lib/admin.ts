import { supabase } from "./supabase";

export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}
