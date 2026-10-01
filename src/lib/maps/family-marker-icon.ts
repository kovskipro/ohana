export const FAMILY_MARKER_PATH =
  "M40.69,67.56c-5.38,0-24.75-16.66-24.75-33.56,0-13.75,11.1-24.94,24.75-24.94s24.75,11.19,24.75,24.94c0,16.91-19.37,33.56-24.75,33.56Z";
export const FAMILY_MARKER_VIEWBOX_WIDTH = 81.39;
export const FAMILY_MARKER_VIEWBOX_HEIGHT = 76.61;
export const FAMILY_MARKER_BODY_WIDTH = 49.5;
export const FAMILY_MARKER_CENTER = {
  x: 40.69,
  y: 33.81,
  radius: 20.75,
} as const;
export const FAMILY_MARKER_RASTER_WIDTH = 112;
export const FAMILY_MARKER_RASTER_HEIGHT = 106;
export const FAMILY_MARKER_PIXEL_RATIO = 2;

export const FAMILY_MARKER_BODY_COLOR = "#FFFFFF";
export const FAMILY_MARKER_STROKE_COLOR = "rgba(0, 0, 0, 0.28)";
export const FAMILY_MARKER_SHADOW_COLOR = "rgba(18, 25, 21, 0.22)";
export const FAMILY_MARKER_INITIALS_BACKGROUND = "#D5D7D4";
export const FAMILY_MARKER_INITIALS_COLOR = "#171A18";
export const FAMILY_MARKER_AVATAR_RING_COLOR = "rgba(255, 255, 255, 0.72)";

const CENTER_DIAMETER = FAMILY_MARKER_CENTER.radius * 2;
const CANVAS_SCALE = Math.min(
  FAMILY_MARKER_RASTER_WIDTH / FAMILY_MARKER_VIEWBOX_WIDTH,
  FAMILY_MARKER_RASTER_HEIGHT / FAMILY_MARKER_VIEWBOX_HEIGHT,
);
const CANVAS_OFFSET_X =
  (FAMILY_MARKER_RASTER_WIDTH - FAMILY_MARKER_VIEWBOX_WIDTH * CANVAS_SCALE) /
  2;
const CANVAS_OFFSET_Y =
  (FAMILY_MARKER_RASTER_HEIGHT - FAMILY_MARKER_VIEWBOX_HEIGHT * CANVAS_SCALE) /
  2;

export function familyMarkerImageId(profileId: string): string {
  return `family-marker:${profileId}`;
}

export function familyMarkerInitials(profileName: string | null): string {
  const words = profileName?.trim().split(/\s+/u).filter(Boolean) ?? [];
  if (words.length === 0) return "?";

  const characters =
    words.length === 1
      ? Array.from(words[0]).slice(0, 2)
      : [Array.from(words[0])[0], Array.from(words.at(-1)!)[0]];
  return characters.join("").toLocaleUpperCase("pl-PL") || "?";
}

function createMarkerCanvas(): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  if (typeof document === "undefined" || typeof Path2D === "undefined") {
    throw new Error("Pinezki rodzin są dostępne wyłącznie w przeglądarce.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = FAMILY_MARKER_RASTER_WIDTH;
  canvas.height = FAMILY_MARKER_RASTER_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Przeglądarka nie udostępniła kontekstu Canvas 2D.");
  }
  context.setTransform(
    CANVAS_SCALE,
    0,
    0,
    CANVAS_SCALE,
    CANVAS_OFFSET_X,
    CANVAS_OFFSET_Y,
  );
  return { canvas, context };
}

function drawFamilyMarkerBase(context: CanvasRenderingContext2D): void {
  const body = new Path2D(FAMILY_MARKER_PATH);

  context.save();
  context.fillStyle = FAMILY_MARKER_BODY_COLOR;
  context.shadowColor = FAMILY_MARKER_SHADOW_COLOR;
  context.shadowBlur = 4;
  context.shadowOffsetY = 3;
  context.fill(body);
  context.shadowColor = "rgba(0, 0, 0, 0)";
  context.strokeStyle = FAMILY_MARKER_STROKE_COLOR;
  context.lineWidth = 1.2;
  context.lineJoin = "round";
  context.stroke(body);
  context.restore();
}

function markerImageData(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): ImageData {
  return context.getImageData(
    0,
    0,
    FAMILY_MARKER_RASTER_WIDTH,
    FAMILY_MARKER_RASTER_HEIGHT,
  );
}

export function createFamilyMarkerFallbackImageData(
  profileName: string | null,
): ImageData {
  const { canvas, context } = createMarkerCanvas();
  drawFamilyMarkerBase(context);

  context.save();
  context.beginPath();
  context.arc(
    FAMILY_MARKER_CENTER.x,
    FAMILY_MARKER_CENTER.y,
    FAMILY_MARKER_CENTER.radius,
    0,
    Math.PI * 2,
  );
  context.fillStyle = FAMILY_MARKER_INITIALS_BACKGROUND;
  context.fill();

  const initials = familyMarkerInitials(profileName);
  context.fillStyle = FAMILY_MARKER_INITIALS_COLOR;
  context.font = `700 ${initials.length === 2 ? 14 : 18}px Geist, Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(initials, FAMILY_MARKER_CENTER.x, FAMILY_MARKER_CENTER.y + 0.5);
  context.restore();

  return markerImageData(canvas, context);
}

export function createFamilyMarkerAvatarImageData(
  image: HTMLImageElement,
): ImageData {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error("Avatar nie ma poprawnych wymiarów.");
  }

  const { canvas, context } = createMarkerCanvas();
  drawFamilyMarkerBase(context);

  const sourceSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = (sourceWidth - sourceSize) / 2;
  const sourceY = (sourceHeight - sourceSize) / 2;
  const centerLeft = FAMILY_MARKER_CENTER.x - FAMILY_MARKER_CENTER.radius;
  const centerTop = FAMILY_MARKER_CENTER.y - FAMILY_MARKER_CENTER.radius;

  context.save();
  context.beginPath();
  context.arc(
    FAMILY_MARKER_CENTER.x,
    FAMILY_MARKER_CENTER.y,
    FAMILY_MARKER_CENTER.radius,
    0,
    Math.PI * 2,
  );
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    centerLeft,
    centerTop,
    CENTER_DIAMETER,
    CENTER_DIAMETER,
  );
  context.restore();

  context.save();
  context.beginPath();
  context.arc(
    FAMILY_MARKER_CENTER.x,
    FAMILY_MARKER_CENTER.y,
    FAMILY_MARKER_CENTER.radius - 0.625,
    0,
    Math.PI * 2,
  );
  context.strokeStyle = FAMILY_MARKER_AVATAR_RING_COLOR;
  context.lineWidth = 1.25;
  context.stroke();
  context.restore();

  return markerImageData(canvas, context);
}

function abortError(signal: AbortSignal): Error | DOMException {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Przerwano ładowanie avatara.", "AbortError");
}

function assertSameOriginAvatarUrl(url: string): void {
  if (typeof window === "undefined") {
    throw new Error("Avatar może zostać pobrany wyłącznie w przeglądarce.");
  }
  const parsed = new URL(url, window.location.origin);
  if (
    parsed.origin !== window.location.origin ||
    !parsed.pathname.startsWith("/api/avatars/")
  ) {
    throw new Error("Niepoprawny adres avatara.");
  }
}

function loadAndDecodeImage(
  image: HTMLImageElement,
  objectUrl: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const removeListeners = () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      signal.removeEventListener("abort", handleAbort);
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      removeListeners();
      if (error) reject(error);
      else resolve();
    };
    const handleLoad = () => {
      void image.decode().then(
        () => finish(),
        () => finish(new Error("Nie udało się zdekodować avatara.")),
      );
    };
    const handleError = () =>
      finish(new Error("Nie udało się wczytać avatara."));
    const handleAbort = () => finish(abortError(signal));

    image.addEventListener("load", handleLoad);
    image.addEventListener("error", handleError);
    signal.addEventListener("abort", handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
      return;
    }
    image.src = objectUrl;
  });
}

export async function loadFamilyMarkerAvatarImageData(
  url: string,
  signal: AbortSignal,
): Promise<ImageData> {
  assertSameOriginAvatarUrl(url);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać avatara (${response.status}).`);
  }
  const blob = await response.blob();
  if (signal.aborted) throw abortError(signal);

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await loadAndDecodeImage(image, objectUrl, signal);
    if (signal.aborted) throw abortError(signal);
    return createFamilyMarkerAvatarImageData(image);
  } finally {
    image.src = "";
    URL.revokeObjectURL(objectUrl);
  }
}
