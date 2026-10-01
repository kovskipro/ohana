// Validation utilities

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePESEL(pesel: string): boolean {
  // PESEL must be exactly 11 digits
  if (!/^\d{11}$/.test(pesel)) return false;
  
  // Basic PESEL format check (could be extended with checksum validation)
  return true;
}

export function validatePhoneNumber(phone: string, countryCode: string): boolean {
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-()]/g, "");
  
  // Polish numbers: 9 digits after country code
  if (countryCode === "+48") {
    return /^\d{9}$/.test(cleaned);
  }
  
  // For other countries, just check that it's all digits and reasonably long
  return /^\d{8,15}$/.test(cleaned);
}

export function validatePostalCode(code: string): boolean {
  // Polish postal code format: XX-XXX
  return /^\d{2}-\d{3}$/.test(code);
}

export function validateDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatPhoneNumber(phone: string, countryCode: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  
  if (countryCode === "+48") {
    // Format: +48 XXX XXX XXX
    return `${countryCode} ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  
  return `${countryCode} ${cleaned}`;
}

export const COUNTRY_CODES = [
  { code: "+48", name: "Polska", flag: "🇵🇱" },
  { code: "+1", name: "USA/Kanada", flag: "🇺🇸" },
  { code: "+44", name: "Wielka Brytania", flag: "🇬🇧" },
  { code: "+33", name: "Francja", flag: "🇫🇷" },
  { code: "+49", name: "Niemcy", flag: "🇩🇪" },
  { code: "+39", name: "Włochy", flag: "🇮🇹" },
  { code: "+34", name: "Hiszpania", flag: "🇪🇸" },
  { code: "+31", name: "Holandia", flag: "🇳🇱" },
  { code: "+32", name: "Belgia", flag: "🇧🇪" },
  { code: "+43", name: "Austria", flag: "🇦🇹" },
  { code: "+41", name: "Szwajcaria", flag: "🇨🇭" },
  { code: "+46", name: "Szwecja", flag: "🇸🇪" },
  { code: "+47", name: "Norwegia", flag: "🇳🇴" },
  { code: "+45", name: "Dania", flag: "🇩🇰" },
  { code: "+358", name: "Finlandia", flag: "🇫🇮" },
  { code: "+353", name: "Irlandia", flag: "🇮🇪" },
  { code: "+352", name: "Luksemburg", flag: "🇱🇺" },
  { code: "+30", name: "Grecja", flag: "🇬🇷" },
  { code: "+36", name: "Węgry", flag: "🇭🇺" },
  { code: "+420", name: "Czechy", flag: "🇨🇿" },
  { code: "+421", name: "Słowacja", flag: "🇸🇰" },
  { code: "+40", name: "Rumunia", flag: "🇷🇴" },
  { code: "+359", name: "Bułgaria", flag: "🇧🇬" },
  { code: "+385", name: "Chorwacja", flag: "🇭🇷" },
  { code: "+381", name: "Serbia", flag: "🇷🇸" },
  { code: "+386", name: "Słowenia", flag: "🇸🇮" },
  { code: "+382", name: "Czarnogóra", flag: "🇲🇪" },
  { code: "+387", name: "Bośnia i Hercegowina", flag: "🇧🇦" },
  { code: "+389", name: "Macedónia", flag: "🇲🇰" },
  { code: "+355", name: "Albania", flag: "🇦🇱" },
  { code: "+356", name: "Malta", flag: "🇲🇹" },
  { code: "+357", name: "Cypr", flag: "🇨🇾" },
  { code: "+60", name: "Malezja", flag: "🇲🇾" },
  { code: "+65", name: "Singapur", flag: "🇸🇬" },
  { code: "+66", name: "Tajlandia", flag: "🇹🇭" },
  { code: "+84", name: "Wietnam", flag: "🇻🇳" },
  { code: "+81", name: "Japonia", flag: "🇯🇵" },
  { code: "+82", name: "Korea Południowa", flag: "🇰🇷" },
  { code: "+86", name: "Chiny", flag: "🇨🇳" },
  { code: "+91", name: "Indie", flag: "🇮🇳" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+880", name: "Bangladesz", flag: "🇧🇩" },
  { code: "+90", name: "Turcja", flag: "🇹🇷" },
  { code: "+212", name: "Maroko", flag: "🇲🇦" },
  { code: "+213", name: "Algieria", flag: "🇩🇿" },
  { code: "+216", name: "Tunezja", flag: "🇹🇳" },
  { code: "+20", name: "Egipt", flag: "🇪🇬" },
  { code: "+27", name: "Republika Południowej Afryki", flag: "🇿🇦" },
  { code: "+55", name: "Brazylia", flag: "🇧🇷" },
  { code: "+56", name: "Chile", flag: "🇨🇱" },
  { code: "+54", name: "Argentyna", flag: "🇦🇷" },
  { code: "+57", name: "Kolumbia", flag: "🇨🇴" },
  { code: "+51", name: "Peru", flag: "🇵🇪" },
  { code: "+58", name: "Wenezuela", flag: "🇻🇪" },
  { code: "+52", name: "Meksyk", flag: "🇲🇽" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+64", name: "Nowa Zelandia", flag: "🇳🇿" },
];

export const VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
] as const;

export type Voivodeship = (typeof VOIVODESHIPS)[number];

export const SCHOOL_CLASSES = [
  "Zerówka",
  "Klasa 1",
  "Klasa 2",
  "Klasa 3",
  "Klasa 4",
  "Klasa 5",
  "Klasa 6",
  "Klasa 7",
  "Klasa 8",
  "Liceum 1",
  "Liceum 2",
  "Liceum 3",
];
