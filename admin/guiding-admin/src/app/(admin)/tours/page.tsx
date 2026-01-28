import { supabaseServer } from "@/lib/supabase/server";
import MarkPaidButton from "./ui/MarkPaidButton";
import Link from "next/link";
import ToursClient from "./ToursClient";

type PaymentRow = {
  id: string;
  slot_id: string;
  guide_id: string | null;
  status: string | null;
  amount_pence: number | null;
};

type SlotRow = {
  id: string;
  slot_date: string | null;
  slot_time: string | null;
  status: string | null;
  guide_id: string | null;
};

export default async function ToursPage() {



  return <ToursClient />;
}
