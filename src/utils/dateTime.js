const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

const parseJakartaDateTimeLocal = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  const text = String(value).trim();
  if (!text) return null;

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    return new Date(text);
  }

  const withSeconds = text.length === 16 ? `${text}:00` : text;
  return new Date(`${withSeconds}+07:00`);
};

const addHours = (date, hours) => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
};

const fitDateToJakartaPublishWindow = (date, windowStartStr = '08:00', windowEndStr = '22:00') => {
  let current = new Date(date.getTime());
  const [startH, startM] = windowStartStr.split(':').map(Number);
  const [endH, endM] = windowEndStr.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (true) {
    const jakartaWallTime = new Date(current.getTime() + JAKARTA_OFFSET_MS);
    const currentMinutes = jakartaWallTime.getUTCHours() * 60 + jakartaWallTime.getUTCMinutes();

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return current;
    }

    if (currentMinutes > endMinutes) {
      jakartaWallTime.setUTCDate(jakartaWallTime.getUTCDate() + 1);
    }

    jakartaWallTime.setUTCHours(startH, startM, 0, 0);
    current = new Date(jakartaWallTime.getTime() - JAKARTA_OFFSET_MS);
  }
};

const formatJakartaDateTime = (date, options = {}) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIME_ZONE,
    dateStyle: options.dateStyle || 'short',
    timeStyle: options.timeStyle || 'short'
  }).format(new Date(date));
};

const formatJakartaDateInputValue = (date) => {
  if (!date) return '';
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return formatter.format(new Date(date)).replace(' ', 'T');
};

module.exports = {
  JAKARTA_TIME_ZONE,
  addHours,
  fitDateToJakartaPublishWindow,
  formatJakartaDateInputValue,
  formatJakartaDateTime,
  parseJakartaDateTimeLocal
};
