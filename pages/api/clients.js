// pages/api/clients.js
import { supabase } from "../../lib/supabaseClient";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  const { user } = await getSession({ req });
  if (!user) return res.status(401).end();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("clients")
      .select("data, id")
      .eq("user_id", user.id);
    if (error) return res.status(500).json({ error });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data: client } = req.body;
    const { error } = await supabase
      .from("clients")
      .insert({ user_id: user.id, data: client });
    if (error) return res.status(500).json({ error });
    return res.status(201).end();
  }
  res.status(405).end();
}
