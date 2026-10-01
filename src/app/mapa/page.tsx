import type { FamilyMapItem } from "@/components/map/FamilyMap";
import { FamilyMapExplorer } from "./FamilyMapExplorer";
import { preconnect, prefetchDNS } from "react-dom";
import { createClient } from "@/lib/supabase/server";
import { avatarPathToUrl } from "@/lib/avatars";

export const metadata = {
  title: "Mapa rodzin — Ohana",
  description:
    "Publiczna mapa rodzin zaangażowanych w Ohana Kooperatywę Edukacyjną.",
};

export default async function MapPage() {
  preconnect("https://tiles.openfreemap.org", {
    crossOrigin: "anonymous",
  });
  prefetchDNS("https://tiles.openfreemap.org");

  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("family_map")
    .select(
      "profile_id, profile_name, city, voivodeship, postal_code, interests, num_children, children_ages, contact_phone, contact_email, contact_fb, contact_instagram, latitude, longitude, geo_status, marker_seed, avatar_path",
    )
    .order("profile_name", { ascending: true });

  if (error) {
    throw error;
  }

  const families: FamilyMapItem[] = (rows ?? []).flatMap(
    ({ avatar_path, ...row }) =>
      row.profile_id
        ? [
            {
              ...row,
              profile_id: row.profile_id,
              avatar_url: avatarPathToUrl(avatar_path),
            },
          ]
        : [],
  );

  return (
    <div>
      <main>
        <h1>
          Mapa rodzin
        </h1>
        <p>
          Rodziny, które zgodziły się na publikację swoich danych na mapie
          Ohany. Widać tu tylko informacje, które każde z nich udostępniło
          dobrowolnie — bez adresów i danych dzieci.
        </p>

        {families.length === 0 ? (
          <p>
            Na razie żadna rodzina nie zdecydowała się na publikację na mapie.
          </p>
        ) : (
          <FamilyMapExplorer families={families} />
        )}
      </main>
    </div>
  );
}
