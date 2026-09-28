/**
 * Drop-off QR. Rendered as a plain image from a public QR service so the app
 * carries no QR dependency; the payload is just the order's drop-off code.
 */
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