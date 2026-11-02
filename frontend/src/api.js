const API_BASE = '/api';

export async function askTaxQuestion({ query, taxYear, topK, threshold }) {
  const res = await fetch(`${API_BASE}/research/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      tax_year: taxYear || null,
      top_k: topK || 4,
      threshold: threshold !== undefined ? threshold : 0.20
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to generate answer' }));
    throw new Error(err.detail || `Server error (${res.status})`);
  }
  return res.json();
}

export async function searchPassagesOnly({ query, topK, threshold }) {
  const res = await fetch(`${API_BASE}/research/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      top_k: topK || 5,
      threshold: threshold !== undefined ? threshold : 0.20
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Search failed' }));
    throw new Error(err.detail || `Server error (${res.status})`);
  }
  return res.json();
}

export async function getResearchHistory() {
  const res = await fetch(`${API_BASE}/research/history`);
  if (!res.ok) throw new Error('Failed to fetch research history');
  return res.json();
}

export async function getDocuments() {
  const res = await fetch(`${API_BASE}/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocument(file, title, sourceUrl) {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  if (sourceUrl) formData.append('source_url', sourceUrl);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || `Server error (${res.status})`);
  }
  return res.json();
}

export async function deleteDocument(docId) {
  const res = await fetch(`${API_BASE}/documents/${docId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function reprocessDocument(docId) {
  const res = await fetch(`${API_BASE}/documents/${docId}/process`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reprocess document');
  return res.json();
}

export async function seedOfficialTaxDocs() {
  const res = await fetch(`${API_BASE}/documents/seed-defaults`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to seed official tax documents');
  return res.json();
}

export async function getSystemStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch system stats');
  return res.json();
}

export async function getHealthStatus() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch health status');
  return res.json();
}
