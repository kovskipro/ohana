import assert from "node:assert/strict";
import {
  avatarPathToUrl,
  isAvatarFileName,
  isAvatarPath,
  isProfileId,
} from "../src/lib/avatars.ts";

function run(name, fn) {
  try {
    fn();
    console.log(`  OK ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}:`, error.message);
    process.exitCode = 1;
  }
}

const profileId = "b48e4cc2-4514-4f14-a53f-ee0c31afcb64";
const otherProfileId = "2b2f25e0-9b34-4bed-a069-1963467ff7f4";
const fileName = "26f338ce-29d6-471e-88a2-43f41eef26c8.webp";
const path = `${profileId}/${fileName}`;

run("akceptuje kanoniczny identyfikator profilu i nazwę WebP UUID v4", () => {
  assert.equal(isProfileId(profileId), true);
  assert.equal(isAvatarFileName(fileName), true);
  assert.equal(isAvatarPath(path), true);
});

run("wymaga, aby ścieżka należała do oczekiwanego profilu", () => {
  assert.equal(isAvatarPath(path, profileId), true);
  assert.equal(isAvatarPath(path, otherProfileId), false);
});

run("odrzuca pełne URL-e, traversal, uppercase, zły format i UUID bez v4", () => {
  assert.equal(isAvatarPath(`https://example.com/${path}`), false);
  assert.equal(isAvatarPath(`${profileId}/../${fileName}`), false);
  assert.equal(isAvatarPath(path.toUpperCase()), false);
  assert.equal(isAvatarFileName(fileName.replace(".webp", ".png")), false);
  assert.equal(
    isAvatarFileName("26f338ce-29d6-371e-88a2-43f41eef26c8.webp"),
    false,
  );
});

run("buduje wyłącznie kontrolowany URL Route Handlera", () => {
  assert.equal(avatarPathToUrl(path), `/api/avatars/${path}`);
  assert.equal(avatarPathToUrl(`https://example.com/${path}`), null);
  assert.equal(avatarPathToUrl(null), null);
});

console.log(
  process.exitCode
    ? "\nNiektóre testy avatarów nie przeszły."
    : "\nWszystkie testy avatarów przeszły.",
);
