import { redirect } from "next/navigation";
import { UNDERCOVER_ONLINE_SETUP_PATH } from "@/games/undercover/paths";

export default function NewRoomPage() {
  redirect(UNDERCOVER_ONLINE_SETUP_PATH);
}
