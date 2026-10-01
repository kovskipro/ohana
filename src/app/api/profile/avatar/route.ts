import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  AVATAR_BUCKET,
  AVATAR_DIMENSION,
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_MAX_OUTPUT_BYTES,
  AVATAR_MAX_SOURCE_DIMENSION,
  AVATAR_MAX_SOURCE_PIXELS,
  avatarPathToUrl,
  isAvatarPath,
} from "@/lib/avatars";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const IMMUTABLE_CACHE_CONTROL = "31536000, immutable";
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

type SupportedImageFormat = "jpeg" | "png" | "webp";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function detectImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

function mimeTypeForFormat(format: SupportedImageFormat) {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

async function encodeAvatar(input: Buffer, quality: number) {
  return sharp(input, {
    failOn: "error",
    limitInputPixels: AVATAR_MAX_SOURCE_PIXELS,
  })
    .rotate()
    .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality })
    .toBuffer();
}

async function removeObjectBestEffort(
  admin: ReturnType<typeof createServiceRoleClient>,
  path: string,
) {
  try {
    await admin.storage.from(AVATAR_BUCKET).remove([path]);
  } catch {
    // Cleanup nie może cofnąć poprawnie zakończonej zmiany w bazie.
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Zaloguj się, aby zmienić zdjęcie profilowe.", 401);
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) >
      AVATAR_MAX_INPUT_BYTES + MULTIPART_OVERHEAD_BYTES
  ) {
    return errorResponse("Plik może mieć maksymalnie 5 MiB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Nie udało się odczytać przesłanego pliku.", 400);
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Wybierz plik ze zdjęciem.", 400);
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    return errorResponse("Plik może mieć maksymalnie 5 MiB.", 413);
  }
  if (!ALLOWED_INPUT_TYPES.has(file.type)) {
    return errorResponse("Dozwolone formaty to JPEG, PNG i WebP.", 415);
  }

  let input: Buffer;
  try {
    input = Buffer.from(await file.arrayBuffer());
  } catch {
    return errorResponse("Nie udało się odczytać przesłanego pliku.", 400);
  }

  const magicFormat = detectImageFormat(input);
  if (!magicFormat || mimeTypeForFormat(magicFormat) !== file.type) {
    return errorResponse("Plik nie jest prawidłowym obrazem JPEG, PNG lub WebP.", 415);
  }

  let avatarBuffer: Buffer;
  try {
    const metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: AVATAR_MAX_SOURCE_PIXELS,
    }).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const pages = metadata.pages ?? 1;

    if (metadata.format !== magicFormat) {
      return errorResponse("Format obrazu nie zgadza się z zawartością pliku.", 415);
    }
    if (pages > 1 || (metadata.pageHeight != null && height > metadata.pageHeight)) {
      return errorResponse("Animowane i wieloklatkowe obrazy nie są obsługiwane.", 422);
    }
    if (
      width < 1 ||
      height < 1 ||
      width > AVATAR_MAX_SOURCE_DIMENSION ||
      height > AVATAR_MAX_SOURCE_DIMENSION ||
      width * height > AVATAR_MAX_SOURCE_PIXELS
    ) {
      return errorResponse(
        "Obraz może mieć maksymalnie 4096 × 4096 pikseli (16 MP).",
        422,
      );
    }

    avatarBuffer = await encodeAvatar(input, 82);
    if (avatarBuffer.byteLength > AVATAR_MAX_OUTPUT_BYTES) {
      avatarBuffer = await encodeAvatar(input, 68);
    }
  } catch {
    return errorResponse("Nie udało się przetworzyć obrazu. Sprawdź plik i spróbuj ponownie.", 422);
  }

  if (avatarBuffer.byteLength > AVATAR_MAX_OUTPUT_BYTES) {
    return errorResponse(
      "Po przetworzeniu zdjęcie nadal przekracza 512 KiB. Wybierz prostszy obraz.",
      422,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return errorResponse("Nie udało się odczytać profilu.", 500);
  }
  if (!profile) {
    return errorResponse("Nie znaleziono profilu.", 404);
  }

  const oldPath = profile.avatar_path;
  const newPath = `${user.id}/${crypto.randomUUID()}.webp`;
  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return errorResponse("Przesyłanie zdjęć jest chwilowo niedostępne.", 503);
  }

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(newPath, avatarBuffer, {
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      contentType: "image/webp",
      upsert: false,
    });
  if (uploadError) {
    return errorResponse("Nie udało się przesłać zdjęcia. Spróbuj ponownie.", 500);
  }

  let updateQuery = admin
    .from("profiles")
    .update({ avatar_path: newPath })
    .eq("id", user.id);
  updateQuery = oldPath
    ? updateQuery.eq("avatar_path", oldPath)
    : updateQuery.is("avatar_path", null);
  const { data: updatedProfile, error: updateError } = await updateQuery
    .select("avatar_path")
    .maybeSingle();

  if (updateError || !updatedProfile) {
    await removeObjectBestEffort(admin, newPath);
    return errorResponse(
      updateError
        ? "Nie udało się zapisać zdjęcia w profilu."
        : "Zdjęcie profilowe zmieniło się równocześnie. Odśwież stronę i spróbuj ponownie.",
      updateError ? 500 : 409,
    );
  }

  if (oldPath && isAvatarPath(oldPath, user.id)) {
    await removeObjectBestEffort(admin, oldPath);
  }

  return NextResponse.json({
    avatarPath: newPath,
    avatarUrl: avatarPathToUrl(newPath),
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Zaloguj się, aby usunąć zdjęcie profilowe.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return errorResponse("Nie udało się odczytać profilu.", 500);
  }
  if (!profile) {
    return errorResponse("Nie znaleziono profilu.", 404);
  }
  if (!profile.avatar_path) {
    return NextResponse.json({ avatarPath: null, avatarUrl: null });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return errorResponse("Usuwanie zdjęć jest chwilowo niedostępne.", 503);
  }

  const oldPath = profile.avatar_path;
  const { data: updatedProfile, error: updateError } = await admin
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", user.id)
    .eq("avatar_path", oldPath)
    .select("avatar_path")
    .maybeSingle();

  if (updateError) {
    return errorResponse("Nie udało się usunąć zdjęcia z profilu.", 500);
  }
  if (!updatedProfile) {
    return errorResponse(
      "Zdjęcie profilowe zmieniło się równocześnie. Odśwież stronę i spróbuj ponownie.",
      409,
    );
  }

  if (isAvatarPath(oldPath, user.id)) {
    await removeObjectBestEffort(admin, oldPath);
  }

  return NextResponse.json({ avatarPath: null, avatarUrl: null });
}
