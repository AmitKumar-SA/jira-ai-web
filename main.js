
// Jira AI Web - Main Logic
// Author: Amit Kumar (akumar6@cvent.com)
// For internal use only. Do NOT distribute or share this code.
//
// Collapsible Settings panel logic (removed legacy settingsHeader handler)
// main.js

document.getElementById('generateBtn').onclick = async function() {
    const statusElem = document.getElementById('status');
    statusElem.textContent = '';
    const taskDesc = document.getElementById('taskDesc').value;
    const azureKey = document.getElementById('azureKey').value;
    if (!taskDesc.trim()) {
        statusElem.textContent = 'Task Description is required.';
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (!azureKey.trim()) {
        statusElem.textContent = 'Azure API Key is required.';
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    statusElem.textContent = 'Generating story...';
    // Call Azure OpenAI API (replace with your endpoint and key)
    try {
        // Azure OpenAI chat completions endpoint
        const endpoint = 'https://cvent-dev2-azure-chatgpt.openai.azure.com';
        const deployment = 'gpt-4.1-mini'; // <-- Replace with your deployment name
        const apiVersion = '2025-01-01-preview'; // <-- Replace with your API version if needed
        const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': azureKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a Jira story writing assistant' },
                    { role: 'user', content: `Generate a Jira story for : ${taskDesc}. The ticket must include the following two clearly labeled sections: 1. Title – A concise summary of the task or issue. 2. Description – A detailed explanation of the background, objective, and scope of work. Also include 'Acceptance Criteria' – A bullet-point list of specific, testable conditions that must be met for the ticket to be considered complete in the description section. Format Acceptance Criteria as : * Given..., when..., then... * Given..., when..., then...` }
                ],
                max_tokens: 600
            })
        });
        if (!response.ok) {
            statusElem.textContent = 'Error generating story. (API error)';
            return;
        }
        const data = await response.json();
        let title = '';
        let description = '';
        if (data.choices?.[0]?.message?.content) {
            const content = data.choices[0].message.content;
            // Extract title (handle markdown bold and newlines)
            const titleRegex = /\*\*Title:?\*\*\s*\n?(.+?)(\n|\r|$)/i;
            const titleMatch = content.match(titleRegex);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim();
            } else {
                // fallback to previous regex if markdown not present
                const fallback = content.match(/Title:?\s*\n?(.+?)(\n|\r|$)/i);
                title = fallback && fallback[1] ? fallback[1].trim() : '';
            }
            // Extract description (handle markdown bold)
            let descriptionOnly = '';
            const descRegex = /\*\*Description:?\*\*\s*\n?([\s\S]*?)(?=\*\*Acceptance Criteria:?\*\*|$)/i;
            const descMatch = content.match(descRegex);
            if (descMatch && descMatch[1]) {
                descriptionOnly = descMatch[1].trim();
            } else {
                // fallback to non-markdown
                const fallbackDesc = content.match(/Description:?\s*\n?([\s\S]*?)(?=Acceptance Criteria:?|$)/i);
                if (fallbackDesc && fallbackDesc[1]) {
                    descriptionOnly = fallbackDesc[1].trim();
                }
            }
            // Extract acceptance criteria (handle markdown bold)
            let acSection = '';
            const acRegex = /\*\*Acceptance Criteria:?\*\*\s*\n?([\s\S]*)/i;
            const acMatch = content.match(acRegex);
            if (acMatch && acMatch[1]) {
                acSection = acMatch[1].trim();
            } else {
                // fallback to non-markdown
                const fallbackAC = content.match(/Acceptance Criteria:?\s*\n?([\s\S]*)/i);
                if (fallbackAC && fallbackAC[1]) {
                    acSection = fallbackAC[1].trim();
                }
            }
            // Combine description and acceptance criteria
            description = descriptionOnly;
            if (acSection) {
                description += `\n\nAcceptance Criteria:\n${acSection}`;
            }
            document.getElementById('storyTitle').value = title;
            document.getElementById('storyDesc').value = description;
            document.getElementById('storySection').style.display = 'block';
            
            // Enable the re-evaluate button now that we have a story
            document.getElementById('reEvaluateBtn').disabled = false;
            
            // Validate story and update checklist (async)
            validateStoryQuality(title, description);
            
            statusElem.textContent = 'Story generated successfully.';
        } else {
            statusElem.textContent = 'No valid response from Azure OpenAI.';
        }
        setTimeout(() => { statusElem.textContent = ''; }, 6000);
    } catch (err) {
        statusElem.textContent = 'Error generating story. (Network or parsing error)';
    }
};

document.getElementById('submitIssuesBtn').onclick = async function() {
    const title = document.getElementById('storyTitle').value;
    const desc = document.getElementById('storyDesc').value;
    const statusElem = document.getElementById('status');
    const createJira = document.getElementById('createJira').checked;
    const createGithub = document.getElementById('createGithub').checked;
    
    if (!createJira && !createGithub) {
        statusElem.textContent = 'Please select at least one platform to create issues.';
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    // Validate all required fields upfront
    let validationErrors = [];
    
    if (createJira) {
        const jiraAuth = document.getElementById('jiraToken').value;
        if (!jiraAuth || !jiraAuth.trim()) {
            validationErrors.push('Jira Auth Token is required to create a Jira ticket');
        }
    }
    
    if (createGithub) {
        const githubAuth = document.getElementById('githubToken').value;
        const githubRepo = document.getElementById('githubRepoLocal').value.trim();
        
        if (!githubAuth || !githubAuth.trim()) {
            validationErrors.push('GitHub Personal Access Token is required to create a GitHub issue');
        }
        
        if (!githubRepo || !githubRepo.trim() || !githubRepo.includes('/')) {
            validationErrors.push('GitHub Repository must be in format "owner/repo"');
        }
    }
    
    // If there are validation errors, show them all and return
    if (validationErrors.length > 0) {
        statusElem.innerHTML = '❌ ' + validationErrors.join('<br>❌ ');
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    
    let results = [];
    
    // Create Jira ticket if selected
    if (createJira) {
        const jiraAuth = document.getElementById('jiraToken').value;
        statusElem.textContent = 'Creating Jira ticket...';
        
        try {
            const labelValue = document.getElementById('label').value.trim() || "JiraAI";
            const project = document.getElementById('project').value;
            const issuetype = document.getElementById('issueType').value;
            const response = await fetch('http://localhost:4000/api/jira/issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-jira-auth-token': jiraAuth
                },
                body: JSON.stringify({
                    fields: {
                        project: { key: project },
                        summary: title,
                        description: desc,
                        issuetype: { name: issuetype },
                        labels: [labelValue],
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const ticketKey = data.key;
                const ticketUrl = `https://jira.cvent.com/browse/${ticketKey}`;
                results.push(`✅ Jira ticket created: <a href="${ticketUrl}" target="_blank" rel="noopener">${ticketKey}</a>`);
            } else {
                results.push('❌ Failed to create Jira ticket');
            }
        } catch (err) {
            results.push('❌ Could not connect to backend proxy for Jira');
        }
    }
    
    // Create GitHub issue if selected
    if (createGithub) {
        const githubAuth = document.getElementById('githubToken').value;
        const githubRepo = document.getElementById('githubRepoLocal').value.trim();
        
        statusElem.textContent = 'Creating GitHub issue...';
        
        try {
            const [owner, repo] = githubRepo.split('/');
            const labelValue = document.getElementById('label').value.trim() || "JiraAI";
            
            const response = await fetch('http://localhost:4000/api/github/issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-github-auth-token': githubAuth
                },
                body: JSON.stringify({
                    owner: owner,
                    repo: repo,
                    title: title,
                    body: desc,
                    labels: [labelValue] // Use the common label field
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const issueNumber = data.number;
                const issueUrl = data.html_url;
                results.push(`✅ GitHub issue created: <a href="${issueUrl}" target="_blank" rel="noopener">#${issueNumber}</a>`);
            } else {
                const errorData = await response.json().catch(() => ({}));
                let errorMsg = `❌ Failed to create GitHub issue (${response.status})`;
                if (errorData.error) {
                    errorMsg += `: ${errorData.error}`;
                }
                results.push(errorMsg);
                console.log('GitHub error details:', errorData);
            }
        } catch (err) {
            results.push('❌ Could not connect to backend proxy for GitHub');
        }
    }
    
    // Display all results
    if (results.length > 0) {
        statusElem.innerHTML = results.join('<br>');
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        statusElem.textContent = 'No issues were created.';
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};

// Story Quality Validation Function using Azure OpenAI
async function validateStoryQuality(title, description) {
    const azureKey = document.getElementById('azureKey').value;
    const checklistContainer = document.getElementById('storyChecklist');
    const qualityIndicator = document.getElementById('qualityIndicator');
    
    // Create a hash of the content to check if we've already validated this exact content
    const contentHash = btoa(title + '|' + description).replace(/[^a-zA-Z0-9]/g, '');
    const cacheKey = `storyValidation_${contentHash}`;
    
    // Check if we have a cached result for this exact content
    const cachedResult = sessionStorage.getItem(cacheKey);
    if (cachedResult) {
        try {
            const validationResult = JSON.parse(cachedResult);
            updateValidationUI(validationResult, checklistContainer, qualityIndicator);
            return;
        } catch (e) {
            // If cached data is corrupted, proceed with fresh validation
            sessionStorage.removeItem(cacheKey);
        }
    }
    
    // Show loading state
    if (checklistContainer) {
        checklistContainer.innerHTML = '<div style="text-align: center; color: #666;">🔄 Validating story quality with AI...</div>';
    }
    if (qualityIndicator) {
        qualityIndicator.innerHTML = '<div style="text-align: center; color: #666;">⏳ Analyzing story...</div>';
    }
    
    try {
        // Azure OpenAI chat completions endpoint
        const endpoint = 'https://cvent-dev2-azure-chatgpt.openai.azure.com';
        const deployment = 'gpt-4.1-mini';
        const apiVersion = '2025-01-01-preview';
        const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
        
        const validationPrompt = `
Analyze the following user story for development readiness. Evaluate each criterion and respond with ONLY a JSON object in this exact format:
{
  "criteria": [
    {"id": "title", "name": "Clear and descriptive title", "passed": true/false, "reason": "brief explanation"},
    {"id": "description", "name": "Detailed description with background and objective", "passed": true/false, "reason": "brief explanation"},
    {"id": "acceptance", "name": "Well-defined acceptance criteria with Given/When/Then format", "passed": true/false, "reason": "brief explanation"},
    {"id": "value", "name": "Clear user value or business objective", "passed": true/false, "reason": "brief explanation"},
    {"id": "specific", "name": "Specific and actionable requirements (no vague terms)", "passed": true/false, "reason": "brief explanation"},
    {"id": "testable", "name": "Testable and measurable outcomes", "passed": true/false, "reason": "brief explanation"}
  ],
  "overallScore": 0-100,
  "recommendation": "Ready for Development/Good/Needs Improvement"
}

Story to analyze:
Title: ${title}
Description: ${description}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': azureKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: 'You are a software development expert who evaluates user stories for development readiness. Respond only with valid JSON. Be consistent in your scoring - identical stories should receive identical scores.' },
                    { role: 'user', content: validationPrompt }
                ],
                max_tokens: 800,
                temperature: 0,  // Set to 0 for maximum consistency
                seed: 12345     // Use a fixed seed for reproducible results
            })
        });
        
        if (!response.ok) {
            throw new Error('Azure API validation failed');
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error('No validation response from Azure');
        }
        
        // Parse the JSON response
        let validationResult;
        try {
            // Clean the response in case there's extra text
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                validationResult = JSON.parse(jsonMatch[0]);
            } else {
                validationResult = JSON.parse(content);
            }
        } catch (parseError) {
            console.error('Failed to parse validation response:', content);
            throw new Error('Invalid validation response format');
        }
        
        // Cache the result for future use
        sessionStorage.setItem(cacheKey, JSON.stringify(validationResult));
        
        // Update UI with the validation result
        updateValidationUI(validationResult, checklistContainer, qualityIndicator);
        
    } catch (error) {
        console.error('Story validation error:', error);
        
        // Show error state
        if (checklistContainer) {
            checklistContainer.innerHTML = '<div style="color: #dc3545; text-align: center;">❌ Unable to validate story quality. Please check your Azure API key.</div>';
        }
        if (qualityIndicator) {
            qualityIndicator.innerHTML = '<div style="color: #dc3545;">⚠️ Validation failed - manual review recommended</div>';
        }
    }
}

// Helper function to update the validation UI
function updateValidationUI(validationResult, checklistContainer, qualityIndicator) {
    // Update checklist in UI
    if (checklistContainer && validationResult.criteria) {
        checklistContainer.innerHTML = '';
        
        validationResult.criteria.forEach(criterion => {
            const checkItem = document.createElement('div');
            checkItem.className = 'checklist-item';
            checkItem.innerHTML = `
                <span class="check-icon ${criterion.passed ? 'check-pass' : 'check-fail'}">${criterion.passed ? '✅' : '❌'}</span>
                <span class="check-text">
                    <strong>${criterion.name}</strong>
                    <br><small style="color: #666;">${criterion.reason}</small>
                </span>
            `;
            checklistContainer.appendChild(checkItem);
        });
    }
    
    // Update overall quality indicator
    if (qualityIndicator && validationResult.overallScore !== undefined) {
        const score = validationResult.overallScore;
        const recommendation = validationResult.recommendation || 'Unknown';
        const passedCount = validationResult.criteria ? validationResult.criteria.filter(c => c.passed).length : 0;
        const totalCount = validationResult.criteria ? validationResult.criteria.length : 6;
        
        let qualityClass = 'quality-needs-improvement';
        let qualityIcon = '⚠️';
        
        if (score >= 85) {
            qualityClass = 'quality-excellent';
            qualityIcon = '🎯';
        } else if (score >= 70) {
            qualityClass = 'quality-good';
            qualityIcon = '👍';
        }
        
        qualityIndicator.className = qualityClass;
        qualityIndicator.innerHTML = `
            <div class="quality-score">
                ${qualityIcon} Story Quality: ${score}% - ${recommendation}
            </div>
            <div class="quality-message">
                ${passedCount} of ${totalCount} criteria met based on AI analysis
                <br><small style="color: #666; font-style: italic;">Click to view detailed checklist</small>
            </div>
        `;
    }
}

// Modal Functions
function showChecklistModal() {
    const modal = document.getElementById('checklistModal');
    if (modal) {
        modal.style.display = 'flex';
        // Add escape key listener
        document.addEventListener('keydown', handleModalEscape);
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }
}

function hideChecklistModal() {
    const modal = document.getElementById('checklistModal');
    if (modal) {
        modal.style.display = 'none';
        // Remove escape key listener
        document.removeEventListener('keydown', handleModalEscape);
        // Restore body scroll
        document.body.style.overflow = 'auto';
    }
}

function handleModalEscape(event) {
    if (event.key === 'Escape') {
        hideChecklistModal();
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('checklistModal');
    if (modal && event.target === modal) {
        hideChecklistModal();
    }
});

// Re-evaluate button functionality
document.getElementById('reEvaluateBtn').onclick = async function() {
    const title = document.getElementById('storyTitle').value;
    const description = document.getElementById('storyDesc').value;
    const statusElem = document.getElementById('status');
    
    if (!title.trim() || !description.trim()) {
        statusElem.textContent = 'Please ensure both title and description are filled before re-evaluating.';
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { statusElem.textContent = ''; }, 4000);
        return;
    }
    
    // Disable button during evaluation to prevent double-clicks
    const reEvaluateBtn = document.getElementById('reEvaluateBtn');
    const originalText = reEvaluateBtn.textContent;
    reEvaluateBtn.disabled = true;
    reEvaluateBtn.textContent = 'Re-evaluating...';
    
    try {
        statusElem.textContent = 'Re-evaluating story quality...';
        await validateStoryQuality(title, description);
        statusElem.textContent = 'Story quality re-evaluated successfully.';
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { statusElem.textContent = ''; }, 3000);
    } catch (error) {
        statusElem.textContent = 'Error during re-evaluation. Please try again.';
        // Scroll to status element to ensure visibility
        statusElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { statusElem.textContent = ''; }, 4000);
    } finally {
        // Re-enable button
        reEvaluateBtn.disabled = false;
        reEvaluateBtn.textContent = originalText;
    }
};
