import QRCode from "qrcode";

/**
 * The dark/light grid of a QR code, row by row. Both apps draw it themselves
 * (react-native-svg on mobile, an inline <svg> on web) so there is no image to
 * host and the code works offline.
 */
export function qrModules(text: string): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(Boolean(qr.modules.get(y, x)));
    rows.push(row);
  }
  return rows;
}
