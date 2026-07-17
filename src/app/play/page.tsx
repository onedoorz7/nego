import { redirect } from "next/navigation";

/** The round list lives on the home screen now. */
export default function PlayIndex() {
  redirect("/");
}
