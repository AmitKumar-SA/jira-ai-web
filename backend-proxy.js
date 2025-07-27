
// Jira AI Web - Backend Proxy
// Author: Amit Kumar (akumar6@cvent.com)
// For internal use only. Do NOT distribute or share this code.
//
// backend-proxy.js
// Simple Node.js/Express proxy for Jira API
// Usage: node backend-proxy.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Proxy endpoint for Jira issue creation
app.post('/api/jira/issue', async (req, res) => {
    const jiraUrl = 'https://jira.cvent.com/rest/api/2/issue';
    // Accept Jira Auth from header (plain, not encoded), fallback to env
    // Pass directly as the Authorization header value
    //const jiraAuth = req.headers['x-jira-auth-token'];
    try {
        const jiraToken = req.headers['x-jira-auth-token'];
        const response = await fetch(jiraUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jiraToken
            },
            body: JSON.stringify(req.body)
        });
        const text = await response.text();
        console.log('Jira response:', text);
        let data;
        try {
            data = JSON.parse(text);
            res.status(response.status).json(data);
        } catch (e) {
            res.status(response.status).send(text);
        }
    } catch (err) {
        res.status(500).json({ error: 'Proxy error', details: err.message });
    }
});

// Proxy endpoint for GitHub issue creation
app.post('/api/github/issue', async (req, res) => {
    try {
        const githubToken = req.headers['x-github-auth-token'];
        const { owner, repo, title, body, labels } = req.body;
        
        console.log('GitHub request details:', { owner, repo, title: title?.substring(0, 50) + '...', hasToken: !!githubToken });
        
        if (!githubToken) {
            return res.status(400).json({ error: 'GitHub token is required' });
        }
        
        if (!owner || !repo) {
            return res.status(400).json({ error: 'Owner and repo are required' });
        }
        
        // First, let's verify the repository exists
        const repoCheckUrl = `https://api.github.com/repos/${owner}/${repo}`;
        console.log('Checking repository:', repoCheckUrl);
        
        const repoCheckResponse = await fetch(repoCheckUrl, {
            method: 'GET',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'JiraAI-WebApp'
            }
        });
        
        if (!repoCheckResponse.ok) {
            const repoError = await repoCheckResponse.text();
            console.log('Repository check failed:', repoCheckResponse.status, repoError);
            
            let errorDetails = `Repository ${owner}/${repo} is not accessible.`;
            
            // Handle specific GitHub errors
            if (repoError.includes('SAML enforcement') || repoError.includes('organization SAML')) {
                errorDetails = `🔒 SAML SSO Issue: Your Personal Access Token needs to be authorized for the organization "${owner}". Please follow these steps:
                
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Find your token and click "Configure SSO"
3. Click "Authorize" next to the "${owner}" organization
4. Try creating the issue again`;
            } else if (repoCheckResponse.status === 404) {
                errorDetails = `Repository "${owner}/${repo}" not found. Please check:
- Repository name is correct (case-sensitive)
- Repository exists and is accessible
- Your token has the right permissions`;
            } else if (repoCheckResponse.status === 401) {
                errorDetails = `Authentication failed. Please check:
- Your GitHub token is valid and not expired
- Token has the required permissions (repo scope)`;
            }
            
            return res.status(repoCheckResponse.status).json({ 
                error: 'Repository not found or no access', 
                details: errorDetails,
                status: repoCheckResponse.status,
                rawError: repoError
            });
        }
        
        const githubUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
        console.log('Creating issue at:', githubUrl);
        
        const issueData = {
            title: title,
            body: body
        };
        
        if (labels && labels.length > 0) {
            issueData.labels = labels;
        }
        
        console.log('Issue data:', JSON.stringify(issueData, null, 2));
        
        const response = await fetch(githubUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'JiraAI-WebApp'
            },
            body: JSON.stringify(issueData)
        });
        
        const text = await response.text();
        console.log('GitHub issue creation response:', response.status, text);
        
        let data;
        try {
            data = JSON.parse(text);
            if (response.ok) {
                console.log('Successfully created GitHub issue:', data.number);
            } else {
                // Handle specific GitHub API errors
                if (text.includes('SAML enforcement') || text.includes('organization SAML')) {
                    data.samlError = true;
                }
            }
            res.status(response.status).json(data);
        } catch (e) {
            console.log('Failed to parse GitHub response as JSON');
            // If it contains SAML error, send a structured response
            if (text.includes('SAML enforcement') || text.includes('organization SAML')) {
                res.status(response.status).json({
                    error: 'SAML SSO Authorization Required',
                    message: 'Resource protected by organization SAML enforcement',
                    details: `🔒 Your Personal Access Token needs SAML SSO authorization for the "${owner}" organization. Please authorize your token in GitHub Settings.`,
                    samlError: true
                });
            } else {
                res.status(response.status).send(text);
            }
        }
    } catch (err) {
        console.error('GitHub proxy error:', err);
        res.status(500).json({ error: 'GitHub proxy error', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Jira proxy server running on http://localhost:${PORT}`);
});
