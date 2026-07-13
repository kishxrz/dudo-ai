export function parseDateTime(message: string): { date: string; time: string; title: string } {
  const now = new Date();
  
  // Calculate Target Date
  const targetDate = new Date(now);
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes('tomorrow')) {
    targetDate.setDate(now.getDate() + 1);
  } else if (msgLower.includes('next week')) {
    targetDate.setDate(now.getDate() + 7);
  } else {
    // Check for weekdays
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const matchedDay = days.findIndex(d => msgLower.includes(d));
    if (matchedDay !== -1) {
      let diff = matchedDay - now.getDay();
      if (diff <= 0) {
        diff += 7;
      }
      targetDate.setDate(now.getDate() + diff);
    }
  }

  // Format date to YYYY-MM-DD
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Parse time
  // Handle patterns like: at 3pm, 3pm, 3:30pm, 10am, 5pm
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const match = message.match(timeRegex);
  
  let hours = 10;
  let minutes = 0;
  
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3].toLowerCase();
    
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
  }

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  // Parse title
  let title = 'Appointment';
  const forMatch = message.match(/\bfor\s+(.+)$/i);
  if (forMatch) {
    let extracted = forMatch[1].trim();
    extracted = extracted.replace(/[.,?!]+$/, '').trim();
    
    // Clean commonly occurring time/date indicators from the title
    let titleClean = extracted;
    const stripRegex = /\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\b\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi;
    titleClean = titleClean.replace(stripRegex, '').replace(/\s+/g, ' ').trim();
    
    // remove leading/trailing "at" or "for" or "on"
    titleClean = titleClean.replace(/^\b(at|for|on)\b/i, '').trim();
    
    // Clean up if it's just a date/time or empty
    const cleanLower = titleClean.toLowerCase();
    const timeIndicators = ['tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'next week', '3pm', '5pm', '10am', 'am', 'pm'];
    const isJustDate = timeIndicators.some(ti => cleanLower === ti || cleanLower === `at ${ti}`);
    if (!isJustDate && titleClean.length > 0) {
      title = titleClean;
    }
  }

  return { date: dateStr, time: timeStr, title };
}
