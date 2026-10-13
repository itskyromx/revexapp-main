/** QR generation is an essential drop-off feature and works with every cookie choice. */
export function QRCodeCard({ value, size = 300 }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(
    value || ""
  )}`;

  return (
    <div className="bg-white border-[3px] border-border p-3 mx-auto w-fit">
      <img src={src} width={size} height={size} alt="Drop-off QR code" className="block w-56 h-56" />
    </div>
  );
}

export default QRCodeCard;
