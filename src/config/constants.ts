// Production base URL used for all publicly-shared loyalty card links & QR codes.
// Never use window.location.origin for QR/WhatsApp links — it captures the
// Lovable preview/dev origin which requires a Lovable login on other devices.
export const PRODUCTION_BASE_URL = "https://fresh-kirkuk-hub.lovable.app";

export const buildCardUrl = (phone: string) =>
  `${PRODUCTION_BASE_URL}/card/${phone}`;

