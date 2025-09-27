document.addEventListener("DOMContentLoaded", () => {
  const contentDiv = document.getElementById("h1");

  // Example text you want to check
  const textToCheck = "Hillary Clinton emails";

  fetch("http://127.0.0.1:5000/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: textToCheck })
  })
    .then(response => response.json())
    .then(data => {
      contentDiv.innerHTML = `
        <p><b>Selected Text:</b> ${data.selected_text}</p>
        <p><b>Bias Notes:</b> ${data.bias_notes}</p>
        <p><b>Summary:</b> ${data.summary}</p>
      `;
    })
    .catch(err => {
      contentDiv.innerHTML = `<p style="color:red;">Error: ${err}</p>`;
    });
});
