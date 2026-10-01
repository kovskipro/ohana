import {
  AVATAR_BUCKET,
  isAvatarFileName,
  isAvatarPath,
  isProfileId,
} from "@/lib/avatars";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new Response(null, { status: 404 });

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string; fileName: string }> },
) {
  const { profileId, fileName } = await context.params;
  if (!isProfileId(profileId) || !isAvatarFileName(fileName)) {
    return notFound();
  }

  const expectedPath = `${profileId}/${fileName}`;
  if (!isAvatarPath(expectedPath, profileId)) {
    return notFound();
  }

  const supabase = await createClient();
  const { data: publicProfile, error: publicProfileError } = await supabase
    .from("family_map")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("avatar_path", expectedPath)
    .maybeSingle();

  let authorized = !publicProfileError && Boolean(publicProfile);
  if (!authorized) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== profileId) {
      return notFound();
    }

    const { data: ownProfile, error: ownProfileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .eq("avatar_path", expectedPath)
      .maybeSingle();
    authorized = !ownProfileError && Boolean(ownProfile);
  }

  if (!authorized) {
    return notFound();
  }

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.storage
      .from(AVATAR_BUCKET)
      .download(expectedPath);
    if (error || !data) {
      return notFound();
    }

    return new Response(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="avatar.webp"',
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
