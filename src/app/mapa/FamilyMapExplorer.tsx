"use client";

import { useRef, useState } from "react";
import {
  FamilyMap,
  hasMapLocation,
  type FamilyMapFocusRequest,
  type FamilyMapItem,
} from "@/components/map/FamilyMap";

export function FamilyMapExplorer({ families }: { families: FamilyMapItem[] }) {
  const reducedMotion = false;
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] =
    useState<FamilyMapFocusRequest | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const requestSequenceRef = useRef(0);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  const announceSelection = (familyId: string, source: "map" | "list") => {
    const family = families.find((item) => item.profile_id === familyId);
    const name = family?.profile_name || "Rodzina";
    setAnnouncement(
      source === "map"
        ? `Wybrano na mapie: ${name}. Przewinięto do karty rodziny.`
        : `Wybrano z listy: ${name}. Mapa pokazuje przybliżoną lokalizację.`,
    );
  };

  const selectFromMap = (familyId: string | null) => {
    if (!familyId) {
      setSelectedFamilyId(null);
      setAnnouncement("Wyczyszczono wybór rodziny na mapie.");
      return;
    }
    setSelectedFamilyId(familyId);
    announceSelection(familyId, "map");
    requestAnimationFrame(() => {
      cardRefs.current.get(familyId)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
      });
    });
  };

  const selectFromList = (family: FamilyMapItem) => {
    if (!hasMapLocation(family)) return;
    requestSequenceRef.current += 1;
    if (selectedFamilyId === family.profile_id) {
      setSelectedFamilyId(null);
      setFocusRequest({
        familyId: null,
        sequence: requestSequenceRef.current,
      });
      setAnnouncement(
        "Odznaczono rodzinę i przywrócono widok całej Polski.",
      );
      mapPanelRef.current?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      return;
    }

    setSelectedFamilyId(family.profile_id);
    setFocusRequest({
      familyId: family.profile_id,
      sequence: requestSequenceRef.current,
    });
    announceSelection(family.profile_id, "list");
    mapPanelRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <>
      <div
        ref={mapPanelRef}
      >
        <div>
          <FamilyMap
            families={families}
            selectedFamilyId={selectedFamilyId}
            focusRequest={focusRequest}
            onSelectFamily={selectFromMap}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
      <p>
        Lokalizacja przybliżona — punkty nie wskazują dokładnych adresów.
      </p>

      <h2>
        Lista rodzin ({families.length})
      </h2>
      <ul>
        {families.map((family) => {
          const active = selectedFamilyId === family.profile_id;
          const hasLocation = hasMapLocation(family);
          return (
            <li
              key={family.profile_id}
              ref={(element) => {
                if (element) cardRefs.current.set(family.profile_id, element);
                else cardRefs.current.delete(family.profile_id);
              }}
              data-family-id={family.profile_id}
              data-active={active ? "true" : "false"}
              
            >
              <button
                type="button"
                disabled={!hasLocation}
                onClick={() => selectFromList(family)}
                aria-pressed={active}
                aria-label={
                  hasLocation
                    ? active
                      ? `Odznacz i pokaż całą Polskę: ${family.profile_name || "Rodzina"}`
                      : `Pokaż na mapie: ${family.profile_name || "Rodzina"}`
                    : `${family.profile_name || "Rodzina"}: lokalizacja niedostępna`
                }
              >
                <div>
                  <Avatar
                    src={family.avatar_url}
                    name={family.profile_name}
                    alt={`Zdjęcie profilowe: ${family.profile_name || "Rodzina"}`}
                    size={48}
                  />
                  <div>
                    <h3>
                      {family.profile_name || "Rodzina"}
                    </h3>

                    <p>
                      {family.city}
                      {family.voivodeship ? `, ${family.voivodeship}` : ""}
                      {family.postal_code ? `, ${family.postal_code}` : ""}
                    </p>
                  </div>
                </div>

                <p>
                  {family.num_children != null
                    ? `${family.num_children} ${
                        family.num_children === 1 ? "dziecko" : "dzieci"
                      }${
                        family.children_ages?.length
                          ? ` (wiek: ${family.children_ages.join(", ")})`
                          : ""
                      }`
                    : "Liczba dzieci nie podana"}
                </p>

                {family.interests && family.interests.length > 0 ? (
                  <div>
                    {family.interests.map((interest) => (
                      <span
                        key={interest}
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                ) : null}

                {!hasLocation ? (
                  <p>
                    Lokalizacja niedostępna — tej karty nie można wskazać na
                    mapie.
                  </p>
                ) : null}
              </button>

              <div>
                {family.contact_phone ? (
                  <p>Telefon: {family.contact_phone}</p>
                ) : null}
                {family.contact_email ? (
                  <p>
                    Email:{" "}
                    <a
                      href={`mailto:${family.contact_email}`}
                    >
                      {family.contact_email}
                    </a>
                  </p>
                ) : null}
                {family.contact_fb ? <p>Facebook: {family.contact_fb}</p> : null}
                {family.contact_instagram ? (
                  <p>Instagram: {family.contact_instagram}</p>
                ) : null}
                {!family.contact_phone &&
                !family.contact_email &&
                !family.contact_fb &&
                !family.contact_instagram ? (
                  <p>Brak danych kontaktowych</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}
