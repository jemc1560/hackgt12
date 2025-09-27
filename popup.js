document.addEventListener('DOMContentLoaded', () => {
    const submitButton = document.getElementById('verify-button');
    const quoteInput = document.getElementById('quote-input');
    const resultArea = document.getElementById('result-area');
    const exitButton = document.getElementById('exitButton');
    exitButton.addEventListener('click', () => {
        window.close();
    });

    submitButton.addEventListener('click', () => {
        const quote = quoteInput.value.trim();
        
        resultArea.innerHTML = "Searching for the truth...";
        submitButton.disabled = true;
        console.log("Verifying quote:", quote);

        // send quote to the background script 
        chrome.runtime.sendMessage({
            action: 'detectMisinformation',
            quote: quote
        }, (response) => {
            submitButton.disabled = false;
            if (chrome.runtime.lastError) {
                console.error("ERROR sending message:", chrome.runtime.lastError);
                resultArea.innerHTML = '<span style="color: red;">ERROR: Could not communicate with the extension background.</span>';
                return; 
            }

            // display the result from the backend 
            if (response && response.result === "success") {
                resultArea.innerHTML = '<span style="color: green;">SUCCESS: The quote is verified.</span>';
            } else {
                resultArea.innerHTML = '<span style="color: red;">ERROR: The quote could not be verified.</span>';
            }
        });
    });

});