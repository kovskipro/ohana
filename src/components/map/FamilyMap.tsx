"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Point,
} from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
  StyleSpecification,
} from "maplibre-gl";
import {
  createFamilyMarkerFallbackImageData,
  familyMarkerImageId,
  FAMILY_MARKER_PIXEL_RATIO,
  FAMILY_MARKER_RASTER_HEIGHT,
  FAMILY_MARKER_RASTER_WIDTH,
  loadFamilyMarkerAvatarImageData,
} from "@/lib/maps/family-marker-icon";
import { spreadPoints } from "@/lib/maps/spread";
import { buildSpiderfyGeoJSON } from "@/lib/maps/spiderfy";
import {
  isMapStyleSpecification,
  localizeMapStyleLabels,
} from "@/lib/maps/style-locale";

export interface FamilyMapItem {
  profile_id: string;
  avatar_url: string | null;
  profile_name: string | null;
  city: string | null;
  voivodeship: string | null;
  postal_code: string | null;
  interests: string[] | null;
  num_children: number | null;
  children_ages: number[] | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_fb: string | null;
  contact_instagram: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_status: "exact" | "approximate" | "failed" | null;
  marker_seed: number | null;
}

export interface FamilyMapFocusRequest {
  familyId: string | null;
  sequence: number;
}

interface DisplayCoordinate {
  latitude: number;
  longitude: number;
}

interface CameraTarget {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

interface MapDataset {
  geojson: FeatureCollection<Point, GeoJsonProperties>;
  coordinatesById: Map<string, DisplayCoordinate>;
  itemsById: Map<string, FamilyMapItem>;
}

type MapStatus = "loading" | "ready" | "error";
type MapLibreModule = typeof import("maplibre-gl");

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const WORKER_URL = "/maplibre-gl-worker.mjs";
const WORKER_SHARED_URL = "/maplibre-gl-shared.mjs";
const MAX_ZOOM = 18;
const CLUSTER_MAX_ZOOM = 13;
const CLUSTER_RADIUS = 44;
const FIRST_MARKERS_DEADLINE_MS = 12_000;
const CAMERA_MOVE_DURATION_MS = 700;
const CAMERA_MOVE_CURVE = 0.8;
const AVATAR_HYDRATION_CONCURRENCY = 4;
const FAMILY_SOURCE = "families";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const SELECTED_LAYER = "selected-family-halo";
const POINT_LAYER = "unclustered-point";
const POINT_CORE_LAYER = "unclustered-point-core";
const SPIDER_SOURCE = "family-spiderfy";
const SPIDER_LINE_LAYER = "family-spiderfy-lines";
const SPIDER_POINT_LAYER = "family-spiderfy-points";
const SPIDER_POINT_CORE_LAYER = "family-spiderfy-point-core";
const INITIAL_MAP_CAMERA = {
  center: [19.48, 52.13] as [number, number],
  zoom: 5.5,
  bearing: 0,
  pitch: 0,
} satisfies CameraTarget;

const EMPTY_SPIDER_DATA: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const MAP_LOCALE: Record<string, string> = {
  "AttributionControl.ToggleAttribution": "Pokaż lub ukryj atrybucję",
  "Map.Title": "Mapa rodzin",
  "NavigationControl.ZoomIn": "Przybliż",
  "NavigationControl.ZoomOut": "Oddal",
  "Popup.Close": "Zamknij",
  "CooperativeGesturesHandler.WindowsHelpText":
    "Przytrzymaj Ctrl i przewijaj, aby przybliżyć mapę",
  "CooperativeGesturesHandler.MacHelpText":
    "Przytrzymaj ⌘ i przewijaj, aby przybliżyć mapę",
  "CooperativeGesturesHandler.MobileHelpText":
    "Użyj dwóch palców, aby przesuwać mapę",
};

let workerWarmupPromise: Promise<void> | undefined;
let mapRuntimePromise: Promise<MapLibreModule> | undefined;

/**
 * Modułowy singleton zachowuje barierę gotowości workera także przy Strict Mode
 * i remountach. Timeout jest zawsze czyszczony, a tymczasowy worker kończony.
 */
async function warmUpWorker(url: string): Promise<void> {
  await Promise.all([
    fetch(url).catch(() => undefined),
    fetch(WORKER_SHARED_URL).catch(() => undefined),
  ]);

  await new Promise<void>((resolve) => {
    let worker: Worker;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      resolve();
    };

    try {
      worker = new Worker(url, { type: "module" });
    } catch {
      resolve();
      return;
    }

    const timeoutId = setTimeout(finish, 2_000);
    worker.onerror = finish;
    worker.onmessage = (event) => {
      if ((event.data as { id?: string } | null)?.id === "ohana-warmup") {
        finish();
      }
    };
    worker.postMessage({
      id: "ohana-warmup",
      type: "ohana-warmup",
      origin: window.location.origin,
      sourceMapId: null,
      targetMapId: null,
      data: null,
    });
  });
}

function getMapRuntime(): Promise<MapLibreModule> {
  if (!mapRuntimePromise) {
    const modulePromise = import("maplibre-gl").then((maplibregl) => {
      maplibregl.setWorkerUrl(WORKER_URL);
      return maplibregl;
    });
    workerWarmupPromise ??= warmUpWorker(WORKER_URL);
    mapRuntimePromise = Promise.all([modulePromise, workerWarmupPromise]).then(
      ([maplibregl]) => maplibregl,
    );
  }
  return mapRuntimePromise;
}

async function loadLocalizedMapStyle(
  signal: AbortSignal,
): Promise<StyleSpecification> {
  const response = await fetch(MAP_STYLE, { signal });
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać stylu mapy (${response.status}).`);
  }

  const style: unknown = await response.json();
  if (!isMapStyleSpecification(style)) {
    throw new Error("Pobrany styl mapy ma niepoprawny format.");
  }

  return localizeMapStyleLabels(style);
}

export function hasMapLocation(family: FamilyMapItem): boolean {
  return (
    family.latitude != null &&
    family.longitude != null &&
    (family.geo_status === "exact" || family.geo_status === "approximate")
  );
}

function buildMapDataset(families: readonly FamilyMapItem[]): MapDataset {
  const itemsById = new Map(
    families.map((family) => [family.profile_id, family]),
  );
  const spread = spreadPoints(
    families.filter(hasMapLocation).map((family) => ({
      profileId: family.profile_id,
      latitude: family.latitude!,
      longitude: family.longitude!,
      city: family.city,
      markerSeed: family.marker_seed ?? 0,
    })),
  );
  const coordinatesById = new Map<string, DisplayCoordinate>();

  const features: Array<Feature<Point, GeoJsonProperties>> = spread.map(
    (family) => {
      coordinatesById.set(family.profileId, {
        latitude: family.displayLatitude,
        longitude: family.displayLongitude,
      });
      return {
        type: "Feature",
        id: family.profileId,
        geometry: {
          type: "Point",
          coordinates: [family.displayLongitude, family.displayLatitude],
        },
        // Publiczne dane profilu nie są duplikowane w GeoJSON. Pełny rekord jest
        // odnajdywany po ID w pamięci komponentu dopiero po interakcji.
        properties: {
          profile_id: family.profileId,
          marker_seed: family.markerSeed,
          marker_icon_id: familyMarkerImageId(family.profileId),
        },
      };
    },
  );

  return {
    geojson: { type: "FeatureCollection", features },
    coordinatesById,
    itemsById,
  };
}

function featureId(feature: MapGeoJSONFeature | undefined): string | null {
  const id = feature?.properties?.profile_id;
  return typeof id === "string" && id ? id : null;
}

function moveCameraDirectly(
  map: MapLibreMap,
  camera: CameraTarget,
  reducedMotion: boolean,
) {
  map.stop();
  if (reducedMotion) {
    map.jumpTo(camera);
    return;
  }

  map.flyTo({
    ...camera,
    duration: CAMERA_MOVE_DURATION_MS,
    curve: CAMERA_MOVE_CURVE,
    essential: false,
  });
}

function popupContent(item: FamilyMapItem): HTMLElement {
  const root = document.createElement("div");


  const name = document.createElement("strong");

  name.textContent = item.profile_name || "Rodzina";
  root.append(name);

  const locationText = [item.city, item.voivodeship]
    .filter(Boolean)
    .join(", ");
  if (locationText) {
    const location = document.createElement("p");

    location.textContent = locationText;
    root.append(location);
  }

  const note = document.createElement("span");

  note.textContent = "Lokalizacja przybliżona";
  root.append(note);
  return root;
}

export function FamilyMap({
  families,
  selectedFamilyId,
  focusRequest,
  onSelectFamily,
  reducedMotion = false,

}: {
  families: FamilyMapItem[];
  selectedFamilyId: string | null;
  focusRequest: FamilyMapFocusRequest | null;
  onSelectFamily: (familyId: string | null) => void;
  reducedMotion?: boolean;

}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moduleRef = useRef<MapLibreModule | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const spiderVisibleRef = useRef(false);
  const pendingFocusRef = useRef<FamilyMapFocusRequest | null>(null);
  const focusFamilyRef = useRef<
    ((request: FamilyMapFocusRequest) => boolean) | null
  >(null);
  const onSelectFamilyRef = useRef(onSelectFamily);
  const reducedMotionRef = useRef(reducedMotion);
  const selectedFamilyIdRef = useRef(selectedFamilyId);
  const statusRef = useRef<MapStatus>("loading");
  const firstMarkersDetectedRef = useRef(false);
  const firstMarkersRenderListenerRef = useRef<(() => void) | null>(null);
  const firstMarkersDeadlineRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const startFirstMarkersDetectionRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [cameraSnapshot, setCameraSnapshot] =
    useState<CameraTarget>(INITIAL_MAP_CAMERA);
  const [renderedClusters, setRenderedClusters] = useState(0);
  const [renderedPoints, setRenderedPoints] = useState(0);
  const [fallbackMarkerCount, setFallbackMarkerCount] = useState(0);
  const [avatarMarkerCount, setAvatarMarkerCount] = useState(0);
  const [firstMarkersVisible, setFirstMarkersVisible] = useState<{
    visible: boolean;
    at: string;
  }>({ visible: false, at: "" });

  const dataset = useMemo(() => buildMapDataset(families), [families]);
  const datasetRef = useRef(dataset);

  const setMapStatus = (nextStatus: MapStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  };

  const stopFirstMarkersDetection = () => {
    const listener = firstMarkersRenderListenerRef.current;
    if (listener && mapRef.current) {
      mapRef.current.off("render", listener);
    }
    firstMarkersRenderListenerRef.current = null;
    if (firstMarkersDeadlineRef.current) {
      clearTimeout(firstMarkersDeadlineRef.current);
      firstMarkersDeadlineRef.current = null;
    }
  };

  const startFirstMarkersDetection = () => {
    if (firstMarkersDetectedRef.current) return;
    stopFirstMarkersDetection();
    const map = mapRef.current;
    if (!map || datasetRef.current.geojson.features.length === 0) return;
    if (!map.getLayer(CLUSTER_LAYER) || !map.getLayer(POINT_CORE_LAYER)) return;

    const listener = () => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      const firstFeature = currentMap.queryRenderedFeatures(undefined, {
        layers: [CLUSTER_LAYER, POINT_CORE_LAYER],
      })[0];
      if (!firstFeature) return;

      const visibleAt = performance.now();
      firstMarkersDetectedRef.current = true;
      stopFirstMarkersDetection();
      performance.mark("ohana-map:first-markers-visible");
      setFirstMarkersVisible({
        visible: true,
        at: visibleAt.toFixed(2),
      });
    };

    firstMarkersRenderListenerRef.current = listener;
    firstMarkersDeadlineRef.current = setTimeout(
      stopFirstMarkersDetection,
      FIRST_MARKERS_DEADLINE_MS,
    );
    map.on("render", listener);
  };

  const clearSpiderfy = () => {
    const map = mapRef.current;
    const source = map?.getSource(SPIDER_SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(EMPTY_SPIDER_DATA);
    spiderVisibleRef.current = false;
  };

  const removePopup = () => {
    popupRef.current?.remove();
    popupRef.current = null;
  };

  const resetMapView = () => {
    const map = mapRef.current;
    if (!map) return false;
    clearSpiderfy();
    removePopup();
    moveCameraDirectly(map, INITIAL_MAP_CAMERA, reducedMotionRef.current);
    return true;
  };

  const showPopup = (familyId: string) => {
    const map = mapRef.current;
    const maplibregl = moduleRef.current;
    const item = datasetRef.current.itemsById.get(familyId);
    const coordinate = datasetRef.current.coordinatesById.get(familyId);
    if (!map || !maplibregl || !item || !coordinate) return;

    removePopup();
    popupRef.current = new maplibregl.Popup({
      offset: 42,
      maxWidth: "min(280px, calc(100vw - 32px))",

    })
      .setLngLat([coordinate.longitude, coordinate.latitude])
      .setDOMContent(popupContent(item))
      .addTo(map);
  };

  const applySelectionFilter = () => {
    const map = mapRef.current;
    if (!map?.getLayer(SELECTED_LAYER)) return;
    const selectedId = selectedFamilyIdRef.current;
    map.setFilter(
      SELECTED_LAYER,
      selectedId
        ? ["all", ["!", ["has", "point_count"]], ["==", ["get", "profile_id"], selectedId]]
        : ["==", ["get", "profile_id"], ""],
    );
  };

  const focusFamily = (request: FamilyMapFocusRequest) => {
    const map = mapRef.current;
    if (!map || !map.getSource(FAMILY_SOURCE)) return false;

    if (request.familyId === null) {
      resetMapView();
      pendingFocusRef.current = null;
      return true;
    }

    const coordinate = datasetRef.current.coordinatesById.get(request.familyId);
    if (!coordinate) return false;

    clearSpiderfy();
    const camera = {
      center: [coordinate.longitude, coordinate.latitude] as [number, number],
      zoom: Math.max(map.getZoom(), 14),
      bearing: 0,
      pitch: 0,
    } satisfies CameraTarget;
    moveCameraDirectly(map, camera, reducedMotionRef.current);
    showPopup(request.familyId);
    pendingFocusRef.current = null;
    return true;
  };

  useEffect(() => {
    datasetRef.current = dataset;
    onSelectFamilyRef.current = onSelectFamily;
    reducedMotionRef.current = reducedMotion;
    selectedFamilyIdRef.current = selectedFamilyId;
    focusFamilyRef.current = focusFamily;
    startFirstMarkersDetectionRef.current = startFirstMarkersDetection;
  });

  useEffect(() => {
    const map = mapRef.current;
    clearSpiderfy();
    popupRef.current?.remove();
    const source = map?.getSource(FAMILY_SOURCE) as GeoJSONSource | undefined;
    if (source) {
      source.setData(dataset.geojson);
      startFirstMarkersDetectionRef.current?.();
    }
  }, [dataset]);

  useEffect(() => {
    applySelectionFilter();
  }, [selectedFamilyId]);

  useEffect(() => {
    if (!focusRequest) return;
    pendingFocusRef.current = focusRequest;
    focusFamilyRef.current?.(focusRequest);
  }, [focusRequest]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    let disposed = false;
    let map: MapLibreMap | null = null;
    const initializationAbortController = new AbortController();
    const avatarHydrationAbortController = new AbortController();
    let avatarHydrationStarted = false;
    let avatarHydrationIdleCallbackId: number | null = null;
    let avatarHydrationTimerId: ReturnType<typeof setTimeout> | null = null;
    const mapRuntime = getMapRuntime();
    const mapStyle = loadLocalizedMapStyle(
      initializationAbortController.signal,
    );

    void Promise.all([mapRuntime, mapStyle])
      .then(([maplibregl, style]) => {
        if (disposed) return;
        moduleRef.current = maplibregl;
        map = new maplibregl.Map({
          container,
          style,
          ...INITIAL_MAP_CAMERA,
          maxZoom: MAX_ZOOM,
          cooperativeGestures: true,
          locale: MAP_LOCALE,
        });
        mapRef.current = map;

        const startAvatarHydration = () => {
          const hydrationMap = map;
          if (
            avatarHydrationStarted ||
            disposed ||
            !hydrationMap ||
            avatarHydrationAbortController.signal.aborted
          ) {
            return;
          }
          avatarHydrationStarted = true;

          const candidates = datasetRef.current.geojson.features.flatMap(
            (feature) => {
              const profileId = feature.properties?.profile_id;
              if (typeof profileId !== "string") return [];
              const avatarUrl =
                datasetRef.current.itemsById.get(profileId)?.avatar_url;
              return avatarUrl
                ? [{ profileId, avatarUrl }]
                : [];
            },
          );
          let nextCandidate = 0;

          const hydrateNext = async () => {
            while (!avatarHydrationAbortController.signal.aborted) {
              const candidateIndex = nextCandidate;
              nextCandidate += 1;
              const candidate = candidates[candidateIndex];
              if (!candidate) return;

              const markerIconId = familyMarkerImageId(candidate.profileId);
              try {
                const avatarImage = await loadFamilyMarkerAvatarImageData(
                  candidate.avatarUrl,
                  avatarHydrationAbortController.signal,
                );
                if (
                  avatarImage.width !== FAMILY_MARKER_RASTER_WIDTH ||
                  avatarImage.height !== FAMILY_MARKER_RASTER_HEIGHT ||
                  disposed ||
                  mapRef.current !== hydrationMap ||
                  !hydrationMap.hasImage(markerIconId)
                ) {
                  continue;
                }
                hydrationMap.updateImage(markerIconId, avatarImage);
                hydrationMap.triggerRepaint();
                setAvatarMarkerCount((count) => count + 1);
                setFallbackMarkerCount((count) => Math.max(0, count - 1));
              } catch {
                // Brak, błędny format lub abort pojedynczego avatara zachowuje fallback.
              }
            }
          };

          void Promise.all(
            Array.from(
              {
                length: Math.min(
                  AVATAR_HYDRATION_CONCURRENCY,
                  candidates.length,
                ),
              },
              hydrateNext,
            ),
          );
        };

        const scheduleAvatarHydration = () => {
          if (disposed || avatarHydrationStarted) return;

          if (typeof window.requestIdleCallback === "function") {
            avatarHydrationIdleCallbackId = window.requestIdleCallback(
              () => {
                avatarHydrationIdleCallbackId = null;
                startAvatarHydration();
              },
              { timeout: 500 },
            );
            return;
          }

          avatarHydrationTimerId = setTimeout(() => {
            avatarHydrationTimerId = null;
            startAvatarHydration();
          }, 0);
        };

        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.addControl(
          new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
          "bottom-left",
        );

        const clearTransientState = () => clearSpiderfy();
        const updateCameraSnapshot = () => {
          if (disposed || !map) return;
          const center = map.getCenter();
          setCameraSnapshot({
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          });
        };
        map.on("zoomstart", clearTransientState);
        map.on("dragstart", clearTransientState);
        map.on("moveend", updateCameraSnapshot);
        map.on("error", () => {
          stopFirstMarkersDetection();
          if (statusRef.current === "loading") {
            setMapStatus("error");
          }
        });

        map.on("load", () => {
          if (disposed || !map) return;
          try {
            let addedFallbacks = 0;
            for (const feature of datasetRef.current.geojson.features) {
              const profileId = feature.properties?.profile_id;
              if (typeof profileId !== "string") continue;
              const markerIconId = familyMarkerImageId(profileId);
              const item = datasetRef.current.itemsById.get(profileId);
              const fallbackImage = createFamilyMarkerFallbackImageData(
                item?.profile_name ?? null,
              );
              if (!map.hasImage(markerIconId)) {
                map.addImage(markerIconId, fallbackImage, {
                  pixelRatio: FAMILY_MARKER_PIXEL_RATIO,
                });
                addedFallbacks += 1;
              }
            }
            setFallbackMarkerCount(addedFallbacks);
            setAvatarMarkerCount(0);
          } catch {
            stopFirstMarkersDetection();
            setMapStatus("error");
            return;
          }

          map.addSource(FAMILY_SOURCE, {
            type: "geojson",
            data: datasetRef.current.geojson,
            cluster: true,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            clusterRadius: CLUSTER_RADIUS,
          });
          map.addSource(SPIDER_SOURCE, {
            type: "geojson",
            data: EMPTY_SPIDER_DATA,
          });

          map.addLayer({
            id: CLUSTER_LAYER,
            type: "circle",
            source: FAMILY_SOURCE,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "rgba(46, 106, 92, 0.85)",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                20,
                10,
                28,
                30,
                36,
              ],
            },
          });

          // Minimalne style używane w E2E mogą nie deklarować glyphs. Positron je
          // ma, więc produkcyjna etykieta liczby rodzin pozostaje bez zmian.
          if (map.getStyle().glyphs) {
            map.addLayer({
              id: CLUSTER_COUNT_LAYER,
              type: "symbol",
              source: FAMILY_SOURCE,
              filter: ["has", "point_count"],
              layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
              },
              paint: { "text-color": "#fff" },
            });
          }

          map.addLayer({
            id: POINT_LAYER,
            type: "circle",
            source: FAMILY_SOURCE,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#000000",
              "circle-opacity": 0.001,
              "circle-radius": 26,
              "circle-translate": [0, -24],
              "circle-translate-anchor": "viewport",
            },
          });
          map.addLayer({
            id: POINT_CORE_LAYER,
            type: "symbol",
            source: FAMILY_SOURCE,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": ["get", "marker_icon_id"],
              "icon-size": 1,
              "icon-anchor": "bottom",
              "icon-offset": [0, 6],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });
          map.addLayer({
            id: SELECTED_LAYER,
            type: "circle",
            source: FAMILY_SOURCE,
            filter: ["==", ["get", "profile_id"], ""],
            paint: {
              "circle-color": "#4568FF",
              "circle-radius": 6.5,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#FFFFFF",
              "circle-translate": [14, -38],
              "circle-translate-anchor": "viewport",
            },
          });
          map.addLayer({
            id: SPIDER_LINE_LAYER,
            type: "line",
            source: SPIDER_SOURCE,
            filter: ["==", ["get", "kind"], "line"],
            paint: {
              "line-color": "rgba(69, 104, 255, 0.7)",
              "line-width": 1.5,
            },
          });
          map.addLayer({
            id: SPIDER_POINT_LAYER,
            type: "circle",
            source: SPIDER_SOURCE,
            filter: ["==", ["get", "kind"], "point"],
            paint: {
              "circle-color": "#000000",
              "circle-opacity": 0.001,
              "circle-radius": 26,
              "circle-translate": [0, -24],
              "circle-translate-anchor": "viewport",
            },
          });
          map.addLayer({
            id: SPIDER_POINT_CORE_LAYER,
            type: "symbol",
            source: SPIDER_SOURCE,
            filter: ["==", ["get", "kind"], "point"],
            layout: {
              "icon-image": ["get", "marker_icon_id"],
              "icon-size": 1,
              "icon-anchor": "bottom",
              "icon-offset": [0, 6],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });

          const showSpiderfy = (
            features: MapGeoJSONFeature[],
            originPoint: { x: number; y: number },
          ) => {
            const entries = features.flatMap((feature) => {
              const id = featureId(feature);
              return id
                ? [
                    {
                      profileId: id,
                      markerSeed: Number(
                        feature.properties?.marker_seed ?? 0,
                      ),
                      markerIconId: familyMarkerImageId(id),
                    },
                  ]
                : [];
            });
            if (new Set(entries.map((entry) => entry.profileId)).size < 2) {
              return false;
            }

            const spiderData = buildSpiderfyGeoJSON(
              entries,
              originPoint,
              ([x, y]) => {
                const coordinate = map!.unproject([x, y]);
                return {
                  longitude: coordinate.lng,
                  latitude: coordinate.lat,
                };
              },
            );
            const source = map!.getSource(SPIDER_SOURCE) as GeoJSONSource;
            source.setData(spiderData);
            spiderVisibleRef.current = true;
            return true;
          };

          map.on("click", CLUSTER_LAYER, async (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            const clusterId = Number(feature?.properties?.cluster_id);
            if (!feature || !Number.isFinite(clusterId)) return;
            const coordinates = (feature.geometry as Point).coordinates as [
              number,
              number,
            ];
            const source = map!.getSource(FAMILY_SOURCE) as GeoJSONSource;
            try {
              const expansionZoom = await source.getClusterExpansionZoom(clusterId);
              map!.easeTo({
                center: coordinates,
                zoom: Math.min(expansionZoom, MAX_ZOOM),
              });
            } catch {
              // Klaster mógł zniknąć podczas asynchronicznego wyliczania zoomu.
            }
          });

          map.on("click", POINT_LAYER, (event: MapLayerMouseEvent) => {
            const id = featureId(event.features?.[0]);
            if (!id) return;
            if (selectedFamilyIdRef.current === id) {
              clearSpiderfy();
              removePopup();
              onSelectFamilyRef.current(null);
              return;
            }

            const hitArea: [[number, number], [number, number]] = [
              [event.point.x - 26, event.point.y - 26],
              [event.point.x + 26, event.point.y + 26],
            ];
            const hits = map!.queryRenderedFeatures(hitArea, {
              layers: [POINT_LAYER],
            });
            if (showSpiderfy(hits, event.point)) return;

            clearSpiderfy();
            onSelectFamilyRef.current(id);
            showPopup(id);
          });

          map.on("click", SPIDER_POINT_LAYER, (event: MapLayerMouseEvent) => {
            const id = featureId(event.features?.[0]);
            if (!id) return;
            if (selectedFamilyIdRef.current === id) {
              clearSpiderfy();
              removePopup();
              onSelectFamilyRef.current(null);
              return;
            }
            clearSpiderfy();
            onSelectFamilyRef.current(id);
            showPopup(id);
          });

          map.on("click", (event) => {
            const hits = map!.queryRenderedFeatures(event.point, {
              layers: [POINT_LAYER, SPIDER_POINT_LAYER, CLUSTER_LAYER],
            });
            if (hits.length > 0) return;
            clearSpiderfy();
            removePopup();
            if (selectedFamilyIdRef.current) {
              onSelectFamilyRef.current(null);
            }
          });

          const updateRenderedFeatureCounts = () => {
            if (!map) return;
            const features = map.queryRenderedFeatures(undefined, {
              layers: [CLUSTER_LAYER, POINT_LAYER],
            });
            const clusters = new Set<number>();
            const points = new Set<string>();
            for (const feature of features) {
              if (feature.layer.id === CLUSTER_LAYER) {
                clusters.add(Number(feature.properties?.cluster_id));
              } else {
                const id = featureId(feature);
                if (id) points.add(id);
              }
            }
            setRenderedClusters(clusters.size);
            setRenderedPoints(points.size);
          };

          startFirstMarkersDetectionRef.current?.();

          applySelectionFilter();
          if (pendingFocusRef.current) {
            focusFamilyRef.current?.(pendingFocusRef.current);
          }
          setMapStatus("ready");
          map.on("idle", () => {
            if (disposed) return;
            updateRenderedFeatureCounts();
          });
          scheduleAvatarHydration();
        });
      })
      .catch(() => {
        initializationAbortController.abort();
        avatarHydrationAbortController.abort();
        if (!disposed) {
          stopFirstMarkersDetection();
          setMapStatus("error");
        }
      });

    return () => {
      disposed = true;
      initializationAbortController.abort();
      avatarHydrationAbortController.abort();
      if (avatarHydrationIdleCallbackId !== null) {
        window.cancelIdleCallback(avatarHydrationIdleCallbackId);
        avatarHydrationIdleCallbackId = null;
      }
      if (avatarHydrationTimerId !== null) {
        clearTimeout(avatarHydrationTimerId);
        avatarHydrationTimerId = null;
      }
      removePopup();
      stopFirstMarkersDetection();
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
    // Inicjalizacja MapLibre jest celowo jednorazowa; dane i sterowanie mają
    // osobne efekty powyżej.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
            data-map-status={status}
      data-map-marker-count={dataset.geojson.features.length}
      data-map-selected-family={selectedFamilyId ?? ""}
      data-map-center={cameraSnapshot.center.join(",")}
      data-map-zoom={cameraSnapshot.zoom}
      data-map-bearing={cameraSnapshot.bearing}
      data-map-pitch={cameraSnapshot.pitch}
      data-map-rendered-clusters={renderedClusters}
      data-map-rendered-points={renderedPoints}
      data-map-fallback-images={fallbackMarkerCount}
      data-map-avatar-images={avatarMarkerCount}
      data-markers-visible={
        dataset.geojson.features.length > 0 && firstMarkersVisible.visible
          ? "true"
          : "false"
      }
      data-markers-visible-at={
        dataset.geojson.features.length > 0 ? firstMarkersVisible.at : ""
      }
      aria-label="Interaktywna mapa przybliżonych lokalizacji rodzin"
    >
      <div>
        <div
          ref={containerRef}
          data-map-container
        />
      </div>
      {status !== "ready" ? (
        <div
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error"
            ? "Nie udało się wczytać mapy. Spróbuj odświeżyć stronę."
            : "Wczytywanie mapy…"}
        </div>
      ) : null}
    </div>
  );
}
