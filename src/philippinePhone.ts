export function normalizePhilippinePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  const subscriberDigits = value.trim().startsWith('+63')
    ? digits.slice(2)
    : digits.startsWith('63') && digits.length === 12
      ? digits.slice(2)
      : digits.startsWith('09') && digits.length === 11
        ? digits.slice(1)
        : digits;
  return subscriberDigits.slice(0, 10);
}

export function isValidPhilippinePhoneNumber(subscriberDigits: string) {
  return /^9\d{9}$/.test(subscriberDigits);
}

export function formatPhilippinePhoneNumber(subscriberDigits: string) {
  return `+63${subscriberDigits}`;
}
