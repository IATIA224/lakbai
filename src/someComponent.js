async function sendEmail() {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'otheruser@example.com',
      subject: 'Hello',
      text: 'Test email via LakbAI'
    }),
  });
  const json = await res.json();
  console.log(json);
}