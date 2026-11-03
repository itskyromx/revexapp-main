export const GRACE_MS = 24 * 60 * 60 * 1000;

export function mediaPath(value: string, projectUrl: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(projectUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/media\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

export function referencePaths(urls: string[], projectUrl: string): Set<string> {
  return new Set(urls.map(url => mediaPath(url, projectUrl)).filter((path): path is string => path !== null));
}

export function isOldImage(object: any, now = Date.now()): boolean {
  return object.metadata?.mimetype?.startsWith('image/') &&
    new Date(object.created_at).getTime() < now - GRACE_MS;
}

export function orphanCandidates(snapshot: any, projectUrl: string, now = Date.now()): any[] {
  const refs = referencePaths(snapshot.references, projectUrl);
  const pending = referencePaths(snapshot.pending, projectUrl);
  return snapshot.objects.filter((object: any) => !refs.has(object.name) &&
    (pending.has(object.name) || isOldImage(object, now)));
}

export function duplicateGroups(objects: any[], now = Date.now()): any[][] {
  const groups = new Map<string, any[]>();
  for (const object of objects) {
    if (!isOldImage(object, now) || !object.metadata.eTag || !object.metadata.size) continue;
    const key = `${object.metadata.size}:${object.metadata.eTag}`;
    groups.set(key, [...(groups.get(key) || []), object]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}
