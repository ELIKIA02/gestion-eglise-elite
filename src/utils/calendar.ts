export function generateGoogleCalendarUrl(event: {
  title: string;
  date: string;
  time?: string;
  description?: string;
  location?: string;
}): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = encodeURIComponent(event.title);
  const start = event.time
    ? event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00'
    : event.date.replace(/-/g, '') + 'T000000';
  const end = event.time
    ? event.date.replace(/-/g, '') + 'T' + event.time.replace(/:/g, '') + '00'
    : event.date.replace(/-/g, '') + 'T235959';
  const details = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.location || '');
  return `${base}&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`;
}

export function generateOutlookCalendarUrl(event: {
  title: string;
  date: string;
  time?: string;
  description?: string;
  location?: string;
}): string {
  const base = 'https://outlook.live.com/calendar/0/deeplink/compose';
  const subject = encodeURIComponent(event.title);
  const startDt = event.time ? `${event.date}T${event.time}:00` : `${event.date}T00:00:00`;
  const endDt = event.time ? `${event.date}T${event.time}:00` : `${event.date}T23:59:00`;
  const body = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.location || '');
  return `${base}?subject=${subject}&startdt=${startDt}&enddt=${endDt}&body=${body}&location=${location}`;
}
