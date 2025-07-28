import { Clothing } from './clothing/clothing.entity';

export function isAuctionActive(clothing: Clothing): boolean {
  const now = new Date();
  return (
    now >= new Date(clothing.initial_date) && now <= new Date(clothing.end_date)
  );
}

export function formatPhoneNumber(phone: string): string {
  let formattedPhone = phone.replace(/[^0-9]/g, '');
  if (formattedPhone.length === 11) {
    formattedPhone = formattedPhone.replace(
      /(\d{2})(\d{5})(\d{4})/,
      '($1) $2-$3',
    );
  } else if (formattedPhone.length === 10) {
    formattedPhone = formattedPhone.replace(
      /(\d{2})(\d{4})(\d{4})/,
      '($1) $2-$3',
    );
  } else if (formattedPhone.length === 9) {
    formattedPhone = formattedPhone.replace(/(\d{5})(\d{4})/, '($1) $2');
  } else if (formattedPhone.length === 8) {
    formattedPhone = formattedPhone.replace(/(\d{4})(\d{4})/, '($1) $2');
  } else {
    formattedPhone = phone; // Return original if format is not recognized
  }
  return formattedPhone;
}
