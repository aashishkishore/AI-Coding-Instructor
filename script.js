const questionInput = document.getElementById('questionInput');
const askButton = document.getElementById('askButton');
const outputArea = document.getElementById('outputArea');
const loadingIndicator = document.getElementById('loadingIndicator');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// ============================
// !!! CRITICAL SECURITY WARNING !!!
// ============================
// NEVER expose your API key in frontend JavaScript. Anyone can view it.
// This is for demonstration ONLY. In a real application, create a backend server
// (e.g., in Node.js, Python, or Go) that securely stores the API key and makes
// the call to the Gemini API. Your frontend should then call your backend.
const GEMINI_API_KEY = "AIzaSyC0xkiWKqRV7A6vqKNLMT2FPnp6exACfCs"; // Replace with your actual key

const MODEL_NAME = "gemini-1.5-flash";
const systemInstructionText = "You are a Coding Instructor, who answers only to coding related problems. If a user asks you anything that is not related to coding, reply to them rudely, like 'You are a dumb person' or 'Stop wasting my time and ask a real coding question'. However, if they ask a problem related to coding, respond in a detailed, helpful, and structured manner. Use Markdown for formatting, including code blocks for code snippets.";

// --- Theme Management ---
/**
 * Sets the theme of the application (light or dark).
 * @param {string} theme - The theme to set ('light' or 'dark').
 */
const setTheme = (theme) => {
    document.body.classList.toggle('light-theme', theme === 'light');
    themeToggleBtn.setAttribute('title', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
    localStorage.setItem('theme', theme);
};

// Event listener for theme toggle button
themeToggleBtn.addEventListener('click', () => {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// Load saved theme on startup
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
});

// --- Main Ask Logic ---
// Event listener for the "Ask Instructor" button
askButton.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    if (!question) {
        outputArea.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Please enter a coding question.</div>';
        return;
    }
    // Check if the API key is still the placeholder
    if (GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
        outputArea.innerHTML = `<div class="error-message"><i class="fas fa-key"></i> Please replace "YOUR_API_KEY_HERE" in the script with your actual Gemini API key.</div>`;
        return;
    }

    // Show loading indicator and disable the button
    outputArea.style.display = 'none';
    loadingIndicator.style.display = 'block';
    askButton.disabled = true;
    askButton.querySelector('span').textContent = 'Thinking...';

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
        contents: [{ role: "user", parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemInstructionText }] }
    };

    try {
        // Make the API call to Gemini
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        // Handle HTTP errors
        if (!response.ok) {
            const errorDetails = data.error ? data.error.message : `HTTP Error ${response.status}`;
            throw new Error(errorDetails);
        }

        // Process the AI response
        if (data.candidates && data.candidates[0]) {
            const rawText = data.candidates[0].content.parts[0].text;
            outputArea.innerHTML = formatAIResponse(rawText);
        } else if (data.promptFeedback) {
            // Handle cases where the prompt was blocked
            throw new Error(`Request was blocked. Reason: ${data.promptFeedback.blockReason}`);
        } else {
            // Handle unexpected response structures
            throw new Error("Received an unexpected response structure from the AI.");
        }

    } catch (error) {
        // Display any errors in the output area
        console.error('Frontend Error:', error);
        outputArea.innerHTML = `<div class="error-message"><i class="fas fa-bug"></i> An error occurred: ${error.message}</div>`;
    } finally {
        // Re-enable the button and hide loading indicator
        askButton.disabled = false;
        askButton.querySelector('span').textContent = 'Ask Instructor';
        loadingIndicator.style.display = 'none';
        outputArea.style.display = 'block';
    }
});

// --- Response Formatting ---
/**
 * Formats the AI's raw text response into HTML, handling Markdown elements.
 * @param {string} text - The raw text response from the AI.
 * @returns {string} - The formatted HTML string.
 */
function formatAIResponse(text) {
    let html = text;

    // 1. Process multiline code blocks (```...```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        // Basic HTML escaping for code content to prevent XSS and ensure proper display
        const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${language}">${escapedCode.trim()}</code></pre>`;
    });

    // 2. Process inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Process headings (##, ###) - Order matters: process longer headings first
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>'); // Added H1 for completeness

    // 4. Process bold text (**...**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 5. Process lists (* or -)
    // This regex handles both unordered and ordered lists.
    // It captures each list item and wraps it in <li>. Then wraps the whole block in <ul>.
    // This simple approach might not handle nested lists or mixed lists perfectly,
    // but it works for basic flat lists.
    html = html.replace(/^\s*[\*-] (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>'); // Added for ordered lists

    // Merge consecutive list tags (e.g., </ul>\n<ul> becomes nothing)
    html = html.replace(/<\/ul>\n<ul>/g, '');
    html = html.replace(/<\/ol>\n<ol>/g, '');

    // 6. Wrap remaining lines in <p> tags
    // This step must be last to avoid wrapping already processed HTML tags in <p>
    html = html.split('\n').map(line => {
        // Check if the line is empty, or already starts with an HTML tag
        if (line.trim() === '' || line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || line.startsWith('<pre') || line.startsWith('<div')) {
            return line;
        }
        return `<p>${line}</p>`;
    }).join('');
    
    return html;
}

// Allow Enter key (but not Shift+Enter) in textarea to submit the question
questionInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent default new line behavior
        askButton.click(); // Simulate a click on the ask button
    }
});
