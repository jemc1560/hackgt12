import {generateText} from './utils.js';

console.log("Content script loaded");

document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('verify-button');
    const quoteInput = document.getElementById('quote-input');
    const resultArea = document.getElementById('result-area');
    const exitButton = document.getElementById('exitButton');
    exitButton.addEventListener('click', () => {
        window.close();
    });

    if (!submitButton || !quoteInput || !resultArea) {
        console.error("One or more required modal elements were not found.");
        return; 
    }

    submitButton.addEventListener('click', async () => {
        const quote = quoteInput.value.trim();
        
        resultArea.innerHTML = "Searching for the truth...";
        submitButton.disabled = true;

        console.log("Verifying quote:", quote);

        // send quote to the background script 
        chrome.runtime.sendMessage({
            action: 'detectMisinformation',
            quote: quote
        }, (response) => {
            if (response && response.result === 'success') {
                let finalHTML = `
                    <div class="verdict">${response.verdict}</div>
                    <div class="summary">${response.summary}</div>
                `;

                // check if the sources array exists 
                if (response.sources && response.sources.length > 0) {
                    finalHTML += `<h4>Key Sources:</h4>`;
                    
                    response.sources.forEach(source => {
                        const sourceTitle = source.title || "Source #" + source.rank; // fallback if title is missing

                        finalHTML += `
                            <div class="source-contain">
                                <a href="${source.source}" target="_blank">
                                    <div class="headline">${sourceTitle}</div>
                                </a>
                                    <p class="reasoning">${source.reasoning}</p>
                            </div>
                        `;
                    });
                    
                    finalHTML += `</ul>`;
                } else {
                    finalHTML += `<p class="no-sources-message">No supporting sources were found for this analysis.</p>`;
                }

                resultArea.innerHTML = finalHTML;
            } else {
                resultArea.innerHTML = `<span style="color: red;">Analysis failed: ${response.message}</span>`;
            }
            submitButton.disabled = false;
            
        });
    });

});