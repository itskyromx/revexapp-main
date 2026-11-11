// Separate cache generation from the client contract so older deployed frontends
// remain compatible while prior two-model decisions are rechecked.
export const POLICY_VERSION = 'revex-omni-moderation-2026-11-09-1';
export const LEGACY_CLIENT_POLICY_VERSION = 'revex-fashion-2026-11-05-1';
export const MAX_BYTES = 5 * 1024 * 1024;
export const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
export function moderationResult(payload: any): { blocked: boolean; reason: string } {
  const r = payload?.results?.[0];
  const scores = r?.category_scores;
  const categories = r?.categories;
  const appliedTypes = r?.category_applied_input_types;
  // Fail closed if the provider response does not confirm image coverage.
  for (const key of ['sexual','violence/graphic','self-harm','self-harm/intent','self-harm/instructions']) {
    if (typeof scores?.[key] !== 'number' || !Number.isFinite(scores[key]) || scores[key]<0 || scores[key]>1 || typeof r?.categories?.[key] !== 'boolean') {
      throw new Error('Invalid moderation response');
    }
    if (!Array.isArray(appliedTypes?.[key]) || !appliedTypes[key].includes('image')) throw new Error('Image moderation category unavailable');
  }
  if (categories['violence/graphic'] || scores['violence/graphic'] >= 0.5) {
    return { blocked: true, reason: 'graphic_violence' };
  }
  if (['self-harm','self-harm/intent','self-harm/instructions'].some(key => categories[key])) {
    return { blocked: true, reason: 'self_harm' };
  }
  // A high threshold reduces false positives on ordinary clothing and swimwear.
  if (scores.sexual >= 0.95) return { blocked: true, reason: 'sexual_content' };
  return { blocked: false, reason: 'safe' };
}

export function rejectionMessage(reason: string): string {
  if (reason === 'graphic_violence') return 'This image contains graphic violence and cannot be uploaded.';
  if (reason === 'self_harm') return 'This image contains self-harm content and cannot be uploaded.';
  if (reason === 'uncertain') return 'We could not safely approve this photo. Choose a clearer photo or contact support if you think this is a mistake.';
  return 'This image does not meet our photo rules. Explicit nudity and sexual content are not allowed; ordinary underwear and swimwear photos are welcome.';
}

export function hasAnimation(bytes: Uint8Array, type: string): boolean {
  const text = (start: number, len: number) => new TextDecoder('latin1').decode(bytes.subarray(start,start+len));
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (type === 'image/png') {
    for (let pos=8; pos+12<=bytes.length;) {
      const length=view.getUint32(pos);
      if (text(pos+4,4)==='acTL') return true;
      pos+=12+length;
    }
  }
  if (type === 'image/webp') {
    for (let pos=12; pos+8<=bytes.length;) {
      const length=view.getUint32(pos+4,true);
      if (['ANIM','ANMF'].includes(text(pos,4))) return true;
      if (text(pos,4)==='VP8X' && length>0 && pos+8<bytes.length && (bytes[pos+8]&2)!==0) return true;
      pos+=8+length+(length%2);
    }
  }
  if (type === 'image/avif') {
    if (bytes.length<16 || text(4,4)!=='ftyp') return true;
    const size=Math.min(view.getUint32(0),bytes.length);
    for (let pos=8; pos+4<=size; pos+=4) if (['avis','msf1'].includes(text(pos,4))) return true;
  }
  return false;
}
