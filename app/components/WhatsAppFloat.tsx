const WHATSAPP_URL =
  "https://wa.me/918309121344?text=Hi%20Sami%2C%20I%20want%20to%20know%20more%20about%20AIforX.";

export function WhatsAppFloat() {
  return (
    <a
      className="whatsapp-float"
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
    >
      <span aria-hidden="true">WA</span>
    </a>
  );
}
