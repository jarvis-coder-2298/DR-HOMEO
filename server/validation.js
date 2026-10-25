export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function string(value, label, max = 500, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label} is required and must be under ${max} characters.`);
  return value.trim();
}
export function email(value, required = true) {
  const result = string(value, 'Email', 254, required);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid email address.');
  return result;
}
export function validateContent(data) {
  if (!data || typeof data !== 'object' || !data.profile) fail('Profile details are missing.');
  const p = data.profile;
  const profile = {};
  for (const key of ['name', 'initials', 'focus', 'location', 'heroTitle', 'heroDescription', 'aboutTitle', 'aboutText', 'aboutSecondary', 'practiceNotice', 'registration', 'registrationNote', 'contactTitle', 'contactText']) {
    profile[key] = string(p[key], key, ['aboutText', 'aboutSecondary'].includes(key) ? 3000 : 600, !['aboutSecondary', 'practiceNotice', 'registrationNote'].includes(key));
  }
  profile.email = email(p.email);
  profile.photoUrl = string(p.photoUrl, 'Photo URL', 2000, false);
  if (profile.photoUrl) {
    try { const url = new URL(profile.photoUrl); if (url.protocol !== 'https:') fail('Photo URL must use HTTPS.'); }
    catch { fail('Photo URL must be a valid HTTPS address.'); }
  }
  function items(key, fields, optional = []) {
    if (!Array.isArray(data[key]) || data[key].length > 30) fail(`${key} must contain at most 30 entries.`);
    const ids = new Set();
    return data[key].map(item => {
      if (!item || typeof item !== 'object') fail(`Invalid ${key} entry.`);
      const result = {};
      for (const field of fields) result[field] = string(item[field], field, field === 'description' ? 2000 : 600, !optional.includes(field));
      if (ids.has(result.id)) fail(`Duplicate ${key} entry.`);
      ids.add(result.id);
      return result;
    });
  }
  const focusAreas = items('focusAreas', ['id', 'title', 'description', 'icon', 'color']);
  for (const area of focusAreas) {
    if (!['leaf', 'heart', 'people'].includes(area.icon) || !['green', 'peach', 'lavender'].includes(area.color)) fail('Choose a supported focus icon and color.');
  }
  return { profile, focusAreas, experience: items('experience', ['id', 'role', 'organization', 'period', 'description', 'status'], ['status']), education: items('education', ['id', 'degree', 'institution', 'detail']) };
}
