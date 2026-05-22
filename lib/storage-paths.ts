import fs from "fs";
import path from "path";

const PROJECT_FOLDER = "pastavirus";

export function resolveProjectPath(storedPath?: string | null): string {
  if (!storedPath) return "";
  if (fs.existsSync(storedPath)) return storedPath;

  const normalized = storedPath.replace(/\\/g, "/");
  const marker = `/${PROJECT_FOLDER}/`;
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);

  if (markerIndex >= 0) {
    const relativeToProject = normalized.slice(markerIndex + marker.length);
    return path.join(process.cwd(), relativeToProject);
  }

  if (normalized.startsWith("storage/")) {
    return path.join(process.cwd(), normalized);
  }

  return storedPath;
}
