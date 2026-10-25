export async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    credentials: 'same-origin', ...options,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'portfolio', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: response.status });
  return data;
}
export const formatDate = value => new Date(value).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
