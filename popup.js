import { generateText } from "./utils.js";

document.addEventListener("DOMContentLoaded", () => {
  const submitButton = document.getElementById("verify-button");
  const quoteInput = document.getElementById("quote-input");
  const resultArea = document.getElementById("result-area");

  if (!submitButton || !quoteInput || !resultArea) {
    console.error("Missing popup elements");
    return;
  }

  submitButton.addEventListener("click", async () => {
    const textToCheck = quoteInput.value.trim();
    if (!textToCheck) {
      resultArea.innerHTML = '<span style="color:red;">Please enter a quote.</span>';
      return;
    }

    resultArea.innerHTML = "Checking the quote...";
    submitButton.disabled = true;

    try {
      // --- Try Flask backend first ---
      const response = await fetch("http://127.0.0.1:8080/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToCheck }),
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();

      resultArea.innerHTML = `
        <p><b>Selected Text:</b> ${data.selected_text}</p>
        <p><b>Bias Notes:</b> ${data.bias_notes}</p>
        <p><b>Summary:</b> ${data.summary}</p>
        <p><b>Sources:</b></p>
        <ul>
          ${data.sources.map(s => `<li><a href="${s.url}" target="_blank">${s.title}</a></li>`).join('')}
        </ul>
      `;

    } catch (err) {
      console.warn("Flask backend unavailable, falling back to Gemini:", err);

      try {
        // --- Fallback: direct Gemini call ---
        const summaryText = await generateText(textToCheck);
        resultArea.innerHTML = `<p><b>Gemini (direct):</b> ${summaryText}</p>`;
      } catch (fallbackErr) {
        console.error("Gemini fallback also failed:", fallbackErr);
        resultArea.innerHTML = `<p style="color:red;">Error: ${fallbackErr.message}</p>`;
      }
    }

    submitButton.disabled = false;
  });
});
