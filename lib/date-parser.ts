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
  let hours = 10;
  let minutes = 0;
  let timeParsed = false;

  // 1. Check with AM/PM (e.g. 3pm, 10am, 3:30 pm, 12:00 am)
  const ampmRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const ampmMatch = message.match(ampmRegex);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3].toLowerCase();
    if (ampm === 'pm' && hours < 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    timeParsed = true;
  }

  // 2. Check 24-hour style or HH:MM without AM/PM (e.g. 15:30, 3:30, 09:15)
  if (!timeParsed) {
    const colonRegex = /\b(\d{1,2}):(\d{2})\b/;
    const colonMatch = message.match(colonRegex);
    if (colonMatch) {
      hours = parseInt(colonMatch[1], 10);
      minutes = parseInt(colonMatch[2], 10);
      // If HH is < 8 (e.g. 3:30), it's highly likely PM in standard business hours
      if (hours > 0 && hours < 8) {
        hours += 12;
      }
      timeParsed = true;
    }
  }

  // 3. Check "at X" or "X o'clock" or similar lone number (e.g. at 3, at 15)
  if (!timeParsed) {
    const loneNumRegex = /\b(?:at|around|slot|time|@)\s*(\d{1,2})\b/i;
    const loneNumMatch = message.match(loneNumRegex);
    if (loneNumMatch) {
      hours = parseInt(loneNumMatch[1], 10);
      minutes = 0;
      if (hours > 0 && hours < 8) {
        hours += 12;
      }
      timeParsed = true;
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
