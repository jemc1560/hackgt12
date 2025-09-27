import {generateText} from './utils.js';

console.log("Content script loaded");

document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('verify-button');
    const quoteInput = document.getElementById('quote-input');
    const resultArea = document.getElementById('result-area');

    if (!submitButton || !quoteInput || !resultArea) {
        console.error("One or more required modal elements were not found.");
        return; 
    }

    submitButton.addEventListener('click', () => {
        const quote = quoteInput.value.trim();
        let summaryText = null;
        
        resultArea.innerHTML = "Searching for the truth...";
        submitButton.disabled = true;

        summaryText = generateText(quote);
        resultArea.innerHTML = summaryText;
        console.log("Generate Text: ", summaryText);
        console.log("\n");
        console.log("Verifying quote:", quote);
    });

});