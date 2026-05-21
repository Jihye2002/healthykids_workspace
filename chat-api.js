async function ragSearch(query) {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  if (!res.ok) {
    throw new Error("API ERROR");
  }

  return await res.json();
}
